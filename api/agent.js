// FILE: /api/agent.js
import '@google/genai';
import { PhysicsAgent } from './_lib/agents/PhysicsAgent.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

// ================== MODIFICA CHIAVE 1 ==================
// Mappa per conservare un'istanza dell'agente per ogni sessione.
// La chiave sarà un ID di sessione, il valore sarà l'istanza di PhysicsAgent.
const activeAgents = new Map();

function getOrCreateAgent(sessionId) {
  if (!activeAgents.has(sessionId)) {
    console.log(`[API] Creating new agent for session ID: ${sessionId}`);
    activeAgents.set(sessionId, new PhysicsAgent(supabaseUrl, supabaseKey));
  }
  return activeAgents.get(sessionId);
}
// ======================================================


export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { action, payload } = req.body;
        
        // ================== MODIFICA CHIAVE 2 ==================
        // Ogni richiesta DEVE contenere un sessionId per identificare l'utente.
        // Il frontend dovrà generarlo e inviarlo ogni volta.
        const { sessionId } = payload;
        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID is missing in payload' });
        }
        
        // Ottieni l'agente specifico per questa sessione.
        const agent = getOrCreateAgent(sessionId);
        // ======================================================

        let result;

        switch (action) {
            case 'analyzeMaterial':
                const buffer = Buffer.from(payload.file.base64, 'base64');
                const fakeBlob = { arrayBuffer: async () => buffer };
                result = await agent.analyzeMaterial({ blob: fakeBlob });
                break;

            case 'startExamination':
                // NON è più necessario ripristinare lo stato. L'istanza dell'agente
                // lo conserva già correttamente dalla chiamata 'analyzeMaterial'.
                result = await agent.startExamination();
                break;

            case 'processResponse':
                // ANCHE QUI, non serve ripristinare lo stato. L'agente
                // sa già a che punto è la conversazione.
                result = await agent.processResponse(payload.responseData);
                break;
            
            case 'generateFinalEvaluation':
                 result = await agent.generateFinalEvaluation();
                 break;

            case 'reset':
                agent.reset();
                // Rimuovi l'agente dalla memoria per evitare memory leak.
                activeAgents.delete(sessionId);
                console.log(`[API] Session ended and agent removed for ID: ${sessionId}`);
                result = { success: true };
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