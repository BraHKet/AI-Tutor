// ==========================================
// FILE: src/agents/modules/ConversationManager.js (SESSIONE CONTINUA MINIMAL)
// ==========================================

import { GoogleGenerativeAI } from '@google/generative-ai';

export class ConversationManager {
    constructor() {
        this.genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        this.chatSession = null;
        this.isActive = false;
    }

    async startSession(pdfData) {
        const systemPrompt = `Tu sei un PROFESSORE UNIVERSITARIO di fisica durante un esame orale.

COMPITO:
1. Analizza questo PDF completamente (tutte le pagine)
2. Identifica tutto ciò che lo studente deve trattare
3. Gestisci l'esame fino al completamento totale

REGOLE:
- Fai domande per coprire TUTTO il PDF
- Non dare suggerimenti (solo interrogare)
- Tieni traccia del progresso
- Lo studente può inviare testo + disegni/formule

FORMATO RISPOSTA (sempre JSON):
{
  "type": "setup|question|completion",
  "message": "Messaggio allo studente",
  "progress": {"covered": 0, "total": 20, "percentage": 0},
  "isComplete": false,
  "mainTopic": "Argomento" // solo nel setup
}

Inizia con type="setup" e la prima domanda.`;

        try {
            this.chatSession = this.model.startChat({ history: [] });
            
            const result = await this.chatSession.sendMessage([
                { inlineData: { mimeType: pdfData.mimeType, data: pdfData.data } },
                { text: systemPrompt }
            ]);
            
            const response = this.parseResponse(result.response.text());
            this.isActive = true;
            
            return {
                success: true,
                mainTopic: response.mainTopic,
                initialQuestion: response.message,
                totalItems: response.progress.total
            };
        } catch (error) {
            console.error('❌ Session start failed:', error);
            throw error;
        }
    }

    async sendMessage(text, image = null) {
        if (!this.isActive || !this.chatSession) {
            throw new Error('No active session');
        }

        try {
            const inputs = [];
            
            if (image) {
                const imageData = image.split(',')[1];
                inputs.push({ inlineData: { mimeType: 'image/png', data: imageData } });
            }
            
            inputs.push({ text: `Studente risponde: "${text}"${image ? ' (con disegno allegato)' : ''}. Valuta e procedi.` });
            
            const result = await this.chatSession.sendMessage(inputs);
            return this.parseResponse(result.response.text());
        } catch (error) {
            console.error('❌ Message failed:', error);
            throw error;
        }
    }

    parseResponse(aiResponse) {
        try {
            const cleanedText = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
            
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0].replace(/,\s*(\]|})/g, '$1'));
                return {
                    type: parsed.type || 'question',
                    message: parsed.message || 'Continui la sua esposizione.',
                    progress: parsed.progress || { covered: 0, total: 1, percentage: 0 },
                    isComplete: parsed.isComplete || false,
                    mainTopic: parsed.mainTopic
                };
            }
        } catch (error) {
            console.error('❌ Parse failed:', error);
        }
        
        // Fallback
        return {
            type: 'question',
            message: 'Continui la sua esposizione.',
            progress: { covered: 0, total: 1, percentage: 0 },
            isComplete: false
        };
    }

    endSession() {
        this.chatSession = null;
        this.isActive = false;
    }
}

export default ConversationManager;