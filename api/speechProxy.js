// api/speechProxy.js
import { SpeechClient } from '@google-cloud/speech';

// L'inizializzazione del client è un punto critico. Se fallisce qui, 
// la funzione potrebbe non avviarsi nemmeno.
console.log("Inizializzando il client SpeechClient...");
const speechClient = new SpeechClient();
console.log("Client SpeechClient inizializzato con successo.");

export default async function handler(req, res) {
  console.log("--- Inizio esecuzione handler /api/speechProxy ---");

  if (req.method !== 'POST') {
    console.warn("Ricevuto metodo non valido:", req.method);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    console.log("Handler avviato, blocco try in esecuzione.");
    
    const { audioBytes } = req.body;
    if (!audioBytes) {
      console.error("Errore: audioBytes mancante nel corpo della richiesta.");
      return res.status(400).json({ error: 'Contenuto audio mancante (audioBytes).' });
    }
    console.log("Ricevuti audioBytes (primi 50 caratteri):", audioBytes.substring(0, 50) + "...");

    const audio = { content: audioBytes };
    const config = {
      encoding: 'WEBM_OPUS',
      sampleRateHertz: 48000,
      languageCode: 'it-IT',
      enableAutomaticPunctuation: true,
    };
    const request = { audio, config };

    console.log("Sto per inviare la richiesta a Google Speech-to-Text...");
    const [response] = await speechClient.recognize(request);
    console.log("Risposta da Google ricevuta con successo.");
    
    const transcription = response.results
      .map(result => result.alternatives[0].transcript)
      .join('\n');
    console.log("Trascrizione completata:", transcription);

    res.status(200).json({ transcription });

  } catch (error) {
    // QUESTO È IL LOG PIÙ IMPORTANTE
    console.error("ERRORE DETTAGLIATO nel blocco catch:", error);
    res.status(500).json({ 
      error: "Errore interno del server.", 
      details: error.message // Invia un messaggio più generico al client per sicurezza
    });
  }
}