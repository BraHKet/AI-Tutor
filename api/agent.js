// FILE: /api/agent.js
import '@google/genai';
// Importa l'agente che ora si trova sul server
import { PhysicsAgent } from './_lib/agents/PhysicsAgent.js';

// NOTA: Le variabili d'ambiente in Vercel sono disponibili direttamente 
// tramite process.env, senza il prefisso REACT_APP_.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

// Crea una singola istanza dell'agente qui
const agent = new PhysicsAgent(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // Il body della richiesta ci dirà quale metodo chiamare
        const { action, payload } = req.body;

        let result;

        switch (action) {
            case 'analyzeMaterial':
    // 1. Convertiamo la stringa base64 in un Buffer (dati binari). Questo è corretto.
    const buffer = Buffer.from(payload.file.base64, 'base64');

    // 2. Creiamo un "falso" oggetto blob. Il tuo PDFProcessor ha solo bisogno
    //    che l'oggetto abbia un metodo .arrayBuffer(), quindi glielo forniamo.
    const fakeBlob = {
        arrayBuffer: async () => buffer,
        // Aggiungiamo altre proprietà se il tuo codice le usa, es:
        type: 'application/pdf',
        size: buffer.length
    };

    // 3. Passiamo l'oggetto file con il nostro fakeBlob.
    result = await agent.analyzeMaterial({ blob: fakeBlob });
    
    // 4. Restituiamo il risultato e lo stato al frontend. Questo è corretto.
    result.currentMaterial = agent.currentMaterial; 
    break;

            case 'startExamination':
                // Ripristiniamo lo stato dall'input del frontend
                agent.currentMaterial = payload.currentMaterial;
                result = await agent.startExamination();
                break;

            case 'processResponse':
                // Ripristiniamo lo stato
                agent.currentMaterial = payload.currentMaterial;
                result = await agent.processResponse(payload.responseData);
                break;
            
            case 'generateFinalEvaluation':
                 result = await agent.generateFinalEvaluation();
                 break;

            case 'reset':
                result = agent.reset();
                break;

            default:
                return res.status(400).json({ error: 'Invalid action' });
        }

        res.status(200).json(result);

    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: error.message });
    }
}