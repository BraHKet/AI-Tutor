// src/utils/geminiSetup.js
import { HarmCategory, HarmBlockThreshold } from "@google/generative-ai";




// Configura il modello che vuoi usare (es. gemini-1.5-flash-latest o gemini-1.5-pro-latest)
const modelName = "gemini-2.0-flash"; // O "gemini-1.5-pro-latest" per più capacità

export const GEMINI_MODEL_NAME = modelName;

export const safetySettings = [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
];

export const model = {
  model: modelName,
  safetySettings: safetySettings,
  // Aggiungiamo un avviso per gli sviluppatori se provano a usarlo in modo errato
  generateContent: () => {
    throw new Error("ERRORE DI SICUREZZA: non chiamare 'model.generateContent()' dal frontend! Usa il proxy API.");
  }
};

// Manteniamo questo log per coerenza, ma aggiorniamo il messaggio
console.log(`Gemini Setup: Caricate le configurazioni per il modello ${modelName}. L'inizializzazione del modello avviene sul backend.`);