// api/speechProxy.js
import { SpeechClient } from '@google-cloud/speech';

// Inizializza il client FUORI dalla funzione handler per riutilizzare la connessione
// Questo è importante per le performance in un ambiente serverless.
const speechClient = new SpeechClient();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. Ricevi l'audio dal frontend. Lo invieremo come stringa base64.
    const { audioBytes } = req.body;
    if (!audioBytes) {
      return res.status(400).json({ error: 'Contenuto audio mancante (audioBytes).' });
    }

    // 2. Prepara la richiesta per l'API di Google Speech-to-Text
    const audio = {
      content: audioBytes, // L'audio è già in formato base64
    };
    const config = {
      encoding: 'WEBM_OPUS', // Il formato più comune registrato dal browser con MediaRecorder
      sampleRateHertz: 48000, // Standard per WEBM_OPUS
      languageCode: 'it-IT',
      enableAutomaticPunctuation: true,
    };
    const request = {
      audio: audio,
      config: config,
    };

    // 3. Invia la richiesta a Google e attendi la trascrizione
    const [response] = await speechClient.recognize(request);
    
    // Concatena tutti i risultati in un'unica stringa
    const transcription = response.results
      .map(result => result.alternatives[0].transcript)
      .join('\n');

    // 4. Invia la trascrizione completa al frontend
    res.status(200).json({ transcription });

  } catch (error) {
    console.error("Errore nel proxy API di Speech:", error);
    res.status(500).json({ error: error.message || "Errore imprevisto sul server." });
  }
}