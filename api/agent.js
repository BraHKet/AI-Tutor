// =========================================================================
// FILE: /api/agent.js (VERSIONE FINALE DEFINITIVA)
// =========================================================================
import { kv } from '@vercel/kv';
import { PhysicsAgent } from './_lib/agents/PhysicsAgent.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { action, payload } = req.body;
        const { sessionId } = payload;

        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID is missing in payload' });
        }

        const sessionKey = `session:${sessionId}`;
        
        // MODIFICA 1: Recupera l'intero oggetto di stato, con valori di default
        const sessionState = await kv.get(sessionKey) || { history: [], material: null };

        // MODIFICA 2: Inietta sia la cronologia che il materiale nell'agente
        const agent = new PhysicsAgent(
            supabaseUrl, 
            supabaseKey, 
            sessionState.history, 
            sessionState.material
        );
        
        let result;

        switch (action) {
            case 'analyzeMaterial':
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
                await kv.del(sessionKey);
                result = { success: true };
                break;

            default:
                return res.status(400).json({ error: 'Invalid action' });
        }

        // MODIFICA 3: Salva l'intero stato aggiornato nella cache
        if (action !== 'reset') {
            const updatedState = agent.getSessionState();
            if (updatedState) {
                await kv.set(sessionKey, updatedState, { ex: 3600 });
            }
        }

        res.status(200).json(result);

    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: error.message });
    }
}