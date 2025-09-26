// FILE: /api/agent.js
import { kv } from '@vercel/kv'; // <-- Importa il client della cache
import { PhysicsAgent } from './_lib/agents/PhysicsAgent.js';

const supabaseUrl = process.env.SUPABASE_URL; // Li teniamo per l'agente se servono
const supabaseKey = process.env.SUPABASE_ANON_KEY;

// LA MAPPA IN MEMORIA È STATA RIMOSSA

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { action, payload } = req.body;
        const { sessionId } = payload;

        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID is missing' });
        }

        // ================== NUOVA LOGICA CON LA CACHE ==================

        // 1. Definisci una chiave univoca per la sessione nella cache
        const sessionKey = `session:${sessionId}`;

        // 2. Recupera la cronologia dalla cache
        const existingHistory = await kv.get(sessionKey) || [];

        // 3. Crea l'agente iniettando la cronologia recuperata
        //    (Questo richiede le piccole modifiche a PhysicsAgent e ConversationManager
        //     che abbiamo discusso nella risposta precedente. Sono ancora necessarie).
        const agent = new PhysicsAgent(supabaseUrl, supabaseKey, existingHistory);

        // =============================================================

        let result;

        switch (action) {
            case 'analyzeMaterial':
                // ... (logica per convertire il blob, non cambia)
                const buffer = Buffer.from(payload.file.base64, 'base64');
                const fakeBlob = { arrayBuffer: async () => buffer };
                result = await agent.analyzeMaterial({ blob: fakeBlob });
                break;

            case 'startExamination':
                result = await agent.startExamination();
                break;

            case 'processResponse':
                result = await agent.processResponse(payload.responseData);
                break;
            
            case 'generateFinalEvaluation':
                 result = await agent.generateFinalEvaluation();
                 break;

            case 'reset':
                // Rimuovi la sessione dalla cache
                await kv.del(sessionKey);
                result = { success: true, message: 'Session reset.' };
                break;

            default:
                return res.status(400).json({ error: 'Invalid action' });
        }

        // =============== SALVA LO STATO AGGIORNATO NELLA CACHE ===============
        if (action !== 'reset') {
            const updatedHistory = agent.getConversationHistory();
            
            // Salva la cronologia aggiornata nella cache con una scadenza (es. 1 ora)
            // 'ex: 3600' significa "expire in 3600 seconds". È buona pratica per non
            // tenere sessioni vecchie all'infinito.
            await kv.set(sessionKey, updatedHistory, { ex: 3600 });
        }
        // ===================================================================

        res.status(200).json(result);

    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: error.message });
    }
}