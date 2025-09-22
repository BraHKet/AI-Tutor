// ==========================================
// FILE: src/agents/modules/ConversationManager.js (SESSIONE CONTINUA + PARSING ROBUSTO)
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

FORMATO RISPOSTA (sempre JSON VALIDO):
{
  "type": "setup",
  "message": "Messaggio allo studente",
  "progress": {"covered": 0, "total": 20, "percentage": 0},
  "isComplete": false,
  "mainTopic": "Argomento"
}

IMPORTANTE: Rispondi SEMPRE e SOLO con JSON valido, senza testo aggiuntivo prima o dopo.

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

    async sendMessage(text, images = []) {
    if (!this.isActive || !this.chatSession) {
        throw new Error('No active session');
    }

    try {
        // Mettiamo prima il testo di contesto
        const textPrompt = { text: `Lo studente ha risposto con del testo e/o dei disegni.

ISTRUZIONI PER TE (SEGUI QUESTO ORDINE):
1.  **ANALIZZA I DISEGNI PRIMA DI TUTTO:** Se ci sono disegni, la tua prima priorità è analizzarli.
2.  **SE IL DISEGNO È CHIARO (Formula, Diagramma, Testo):** Usalo come parte principale della risposta dello studente.
3.  **SE IL DISEGNO NON È CHIARO O È ASTRATTO:** Non dire che è vuoto o illeggibile. Invece, descrivi letteralmente ciò che vedi. Esempio: "Nel disegno vedo una linea a zig-zag e una curva." POI procedi con l'esame.
4.  **VALUTA IL TESTO:** Leggi anche il testo fornito dallo studente ("${text}").
5.  **FORMULA LA RISPOSTA:** Combina l'analisi di testo e immagini, e procedi con la prossima domanda dell'esame.

IMPORTANTE: Rispondi SEMPRE e SOLO con JSON valido nel formato:
{
  "type": "question",
  "message": "La tua risposta (che include l'analisi dei disegni) e/o la prossima domanda",
  "progress": {"covered": X, "total": Y, "percentage": Z},
  "isComplete": false
}`};

        const inputs = [ textPrompt ];
        
        // Aggiungiamo le immagini dopo
        if (images && images.length > 0) {
            for (const singleImage of images) {
                // ... (il tuo codice di debug per stampare l'immagine può rimanere qui se vuoi) ...
                const imageData = singleImage.split(',')[1];
                inputs.push({ inlineData: { mimeType: 'image/png', data: imageData } });
            }
        }
        
        const result = await this.chatSession.sendMessage(inputs);
        return this.parseResponse(result.response.text());
    } catch (error) {
        console.error('❌ Message failed:', error);
        throw error;
    }
}

    parseResponse(aiResponse) {
        console.log('🔍 Raw AI Response:', aiResponse);
        
        try {
            // Pulizia molto più aggressiva
            let cleanedText = aiResponse;
            
            // Rimuovi markdown code blocks
            cleanedText = cleanedText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
            
            // Rimuovi testo prima e dopo JSON
            cleanedText = cleanedText.replace(/^[^{]*/, '').replace(/[^}]*$/, '');
            
            // Trova il JSON usando diverse strategie
            let jsonString = null;
            
            // Strategia 1: Match JSON completo
            const fullJsonMatch = cleanedText.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
            if (fullJsonMatch) {
                jsonString = fullJsonMatch[0];
            }
            
            // Strategia 2: Se non trova, cerca il primo { fino all'ultimo }
            if (!jsonString) {
                const firstBrace = cleanedText.indexOf('{');
                const lastBrace = cleanedText.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                    jsonString = cleanedText.substring(firstBrace, lastBrace + 1);
                }
            }
            
            if (jsonString) {
                // Pulizia finale del JSON
                jsonString = jsonString
                    .replace(/,\s*([}\]])/g, '$1') // Rimuovi virgole finali
                    .replace(/\n/g, ' ') // Sostituisci newline con spazi
                    .replace(/\r/g, '') // Rimuovi carriage return
                    .replace(/\t/g, ' ') // Sostituisci tab con spazi
                    .replace(/\\/g, '\\\\') // Escape backslashes
                    .trim();
                
                console.log('🧹 Cleaned JSON:', jsonString);
                
                try {
                    const parsed = JSON.parse(jsonString);
                    
                    // Validazione e normalizzazione
                    const normalized = {
                        type: this.validateString(parsed.type, 'question'),
                        message: this.validateString(parsed.message, 'Continui la sua esposizione.'),
                        progress: this.validateProgress(parsed.progress),
                        isComplete: Boolean(parsed.isComplete),
                        mainTopic: this.validateString(parsed.mainTopic, undefined)
                    };
                    
                    console.log('✅ Parsed successfully:', normalized);
                    return normalized;
                    
                } catch (parseError) {
                    console.error('❌ JSON Parse Error:', parseError);
                    console.error('❌ Failed JSON string:', jsonString);
                    throw parseError;
                }
            } else {
                throw new Error('No JSON object found in response');
            }
            
        } catch (error) {
            console.error('❌ Parse failed completely:', error);
            console.error('❌ Original response:', aiResponse);
            
            // Fallback robusto con analisi della risposta
            return this.createIntelligentFallback(aiResponse);
        }
    }

    validateString(value, defaultValue) {
        return (typeof value === 'string' && value.trim()) ? value.trim() : defaultValue;
    }

    validateProgress(progress) {
        if (!progress || typeof progress !== 'object') {
            return { covered: 0, total: 1, percentage: 0 };
        }
        
        const covered = Math.max(0, parseInt(progress.covered) || 0);
        const total = Math.max(1, parseInt(progress.total) || 1);
        const percentage = Math.min(100, Math.max(0, parseInt(progress.percentage) || Math.round((covered / total) * 100)));
        
        return { covered, total, percentage };
    }

    createIntelligentFallback(originalResponse) {
        console.log('🔄 Creating intelligent fallback...');
        
        // Analizza la risposta per estrarre informazioni utili
        const response = originalResponse.toLowerCase();
        
        let message = 'Continui la sua esposizione.';
        let type = 'question';
        let isComplete = false;
        
        // Cerca indicatori di completamento
        if (response.includes('completo') || response.includes('finito') || response.includes('terminato')) {
            isComplete = true;
            type = 'completion';
            message = 'Esame completato. Ottimo lavoro!';
        }
        // Cerca indicatori di setup iniziale
        else if (response.includes('inizio') || response.includes('iniziamo') || response.includes('cominciamo')) {
            type = 'setup';
            message = 'Iniziamo l\'esame. Mi faccia una trattazione completa del materiale.';
        }
        // Estrai un messaggio più specifico se possibile
        else {
            // Cerca frasi che sembrano domande del professore
            const sentences = originalResponse.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
            if (sentences.length > 0) {
                // Prendi la prima frase significativa
                const bestSentence = sentences.find(s => 
                    s.includes('può') || s.includes('spieg') || s.includes('descri') || 
                    s.includes('illustr') || s.includes('dimostr') || s.includes('cos')
                ) || sentences[0];
                
                if (bestSentence && bestSentence.length < 200) {
                    message = bestSentence.charAt(0).toUpperCase() + bestSentence.slice(1);
                    if (!message.endsWith('.') && !message.endsWith('?') && !message.endsWith('!')) {
                        message += '?';
                    }
                }
            }
        }
        
        const fallback = {
            type: type,
            message: message,
            progress: { covered: 0, total: 1, percentage: 0 },
            isComplete: isComplete,
            mainTopic: undefined
        };
        
        console.log('🆘 Fallback created:', fallback);
        return fallback;
    }

    endSession() {
        this.chatSession = null;
        this.isActive = false;
    }
}

export default ConversationManager;