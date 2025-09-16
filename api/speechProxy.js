// api/speechProxy.js
import { SpeechClient } from '@google-cloud/speech';

// --- Inizio Blocco di Inizializzazione Corretto ---

// 1. Leggi la stringa JSON contenente le credenziali dalla variabile d'ambiente di Vercel.
const credentialsJsonString = process.env.GOOGLE_APPLICATION_CREDENTIALS;

// 2. Parsifica la stringa JSON in un oggetto JavaScript.
//    Aggiungiamo un controllo per assicurarci che la variabile esista.
if (!credentialsJsonString) {
  throw new Error('La variabile d\'ambiente GOOGLE_APPLICATION_CREDENTIALS non è stata impostata.');
}
const credentials = JSON.parse(credentialsJsonString);

// 3. Inizializza il client di Google Speech-to-Text passando esplicitamente 
//    l'oggetto delle credenziali. Questo evita che il client cerchi un file su disco.
const speechClient = new SpeechClient({ credentials });

// --- Fine Blocco di Inizializzazione Corretto ---


export default async function handler(req, res) {
  // Accetta solo richieste di tipo POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. Ricevi l'audio in formato base64 dal corpo della richiesta.
    const { audioBytes } = req.body;
    if (!audioBytes) {
      return res.status(400).json({ error: 'Contenuto audio mancante nel corpo della richiesta (audioBytes).' });
    }

    // 2. Prepara la richiesta per l'API di Google Speech-to-Text.
    const audio = {
      content: audioBytes, // L'audio è già una stringa base64
    };
    const config = {
      encoding: 'WEBM_OPUS',   // Formato audio registrato dal browser con MediaRecorder
      sampleRateHertz: 48000,  // Frequenza di campionamento standard per WEBM_OPUS
      languageCode: 'it-IT',
      enableAutomaticPunctuation: true,
    };
    const request = {
      audio: audio,
      config: config,
    };

    // 3. Invia la richiesta a Google e attendi il risultato della trascrizione.
    const [response] = await speechClient.recognize(request);
    
    // 4. Estrai e concatena tutti i risultati della trascrizione in un'unica stringa.
    const transcription = response.results
      .map(result => result.alternatives[0].transcript)
      .join('\n');

    // 5. Invia la trascrizione completata come risposta al frontend.
    res.status(200).json({ transcription });

  } catch (error) {
    // In caso di qualsiasi errore durante il processo, loggalo sul server 
    // e invia una risposta di errore generica al client.
    console.error("Errore critico nel proxy API di Speech:", error);
    res.status(500).json({ error: "Un errore imprevisto è accaduto sul server." });
  }
}