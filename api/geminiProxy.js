// api/geminiProxy.js
import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  // Accetta solo richieste di tipo POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. Leggi la chiave API segreta dalle variabili d'ambiente di Vercel (che hai impostato)
    const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
    if (!apiKey) {
      console.error("ERRORE SERVER: La variabile d'ambiente REACT_APP_GEMINI_API_KEY non è impostata.");
      return res.status(500).json({ error: "Configurazione del server incompleta." });
    }

    // Inizializza il client di Gemini sul backend
    const genAI = new GoogleGenerativeAI(apiKey);

    // 2. Prendi il payload completo inviato dal frontend
    const { requestPayload } = req.body;

    if (!requestPayload || !requestPayload.contents) {
        return res.status(400).json({ error: 'Il payload della richiesta (requestPayload) è mancante o malformato.' });
    }

    // Estrai il nome del modello e le configurazioni dal payload
    const modelName = requestPayload.modelName || 'gemini-1.5-flash';
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      safetySettings: requestPayload.safetySettings
    });
    console.log("Model inizializzato:", model);

    // 3. Esegui la chiamata a Gemini dal backend usando i dati forniti
    const result = await model.generateContent(requestPayload);
    const response = await result.response;
    const text = response.text();

    // 4. Invia la risposta testuale di Gemini di nuovo al frontend
    res.status(200).json({ text });

  } catch (error) {
    console.error("Errore nel proxy API di Gemini:", error);
    res.status(500).json({ error: error.message || "Un errore imprevisto è accaduto sul server." });
  }
}