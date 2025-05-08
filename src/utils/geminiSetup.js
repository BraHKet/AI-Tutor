// src/utils/geminiSetup.js
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

const apiKey = "AIzaSyCkw0bYs0jEa5La26hcWWQyGhBFSxhbdVU";
if (!apiKey) {
  throw new Error("REACT_APP_GEMINI_API_KEY is not defined. Please set it in your .env file.");
}

export const genAI = new GoogleGenerativeAI(apiKey);

// Configura il modello che vuoi usare (es. gemini-1.5-flash-latest o gemini-1.5-pro-latest)
const modelName = "gemini-1.5-flash-latest"; // O "gemini-1.5-pro-latest" per più capacità

export const model = genAI.getGenerativeModel({
  model: modelName,
  // Impostazioni di sicurezza (opzionali, ma possono prevenire blocchi per contenuti borderline)
  safetySettings: [
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
  ],
  // systemInstruction: "You are a helpful AI assistant for students creating study plans." // Esempio
});

console.log(`Gemini Setup: Initialized model ${modelName}`);