// ==========================================
// FILE: src/agents/modules/ConversationManager.js
// VERSIONE CHATGPT: OpenAI API invece di Gemini
// ==========================================

import OpenAI from 'openai';

export class ConversationManager {
    constructor() {
        // Inizializza OpenAI client
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY, // Assicurati di avere questa variabile d'ambiente
        });

        this.chatSession = null;
        this.isActive = false;
        this.conversationHistory = []; // ChatGPT usa la cronologia delle conversazioni
    }

    async startSession(pdfData) {
        console.log('🚀 [DEBUG] Starting ChatGPT session...');
        console.log('🚀 [DEBUG] PDF data received:', {
            mimeType: pdfData.mimeType,
            dataLength: pdfData.data ? pdfData.data.length : 'NO DATA',
            hasData: !!pdfData.data
        });

        const systemPrompt = `Tu sei un PROFESSORE UNIVERSITARIO durante un esame orale.

COMPITO:
1. Analizza questo contenuto PDF completamente
2. Identifica tutto ciò che lo studente deve trattare
3. Gestisci l'esame fino al completamento totale

REGOLE:
- Fai domande per coprire TUTTO il contenuto
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
            // ChatGPT non supporta PDF direttamente, quindi estraiamo il testo o usiamo un servizio
            console.log('📄 [DEBUG] Converting PDF to text for ChatGPT...');
            
            let pdfContent = "Contenuto PDF non disponibile per l'analisi diretta con ChatGPT.";
            
            try {
    const pdfParse = await import('pdf-parse');

    console.log("📊 [DEBUG] typeof pdfData.data:", typeof pdfData.data);
    if (typeof pdfData.data === "string") {
        console.log("📊 [DEBUG] pdfData.data preview:", pdfData.data.substring(0, 200));
    } else if (Buffer.isBuffer(pdfData.data)) {
        console.log("📊 [DEBUG] pdfData.data is already a Buffer, length:", pdfData.data.length);
    }

    let pdfBuffer;
    if (Buffer.isBuffer(pdfData.data)) {
        pdfBuffer = pdfData.data;
    } else if (typeof pdfData.data === "string") {
        if (pdfData.data.trim().endsWith(".pdf")) {
            const fs = await import("fs");
            pdfBuffer = fs.readFileSync(pdfData.data);
            console.log("✅ [DEBUG] Caricato PDF da file:", pdfData.data);
        } else {
            pdfBuffer = Buffer.from(pdfData.data, "base64");
            console.log("✅ [DEBUG] Decodificato PDF da base64");
        }
    }

    const pdfResult = await pdfParse.default(pdfBuffer);
    pdfContent = pdfResult.text;
    console.log("✅ [DEBUG] Estratto testo PDF, length:", pdfContent.length);
} catch (pdfError) {
    console.warn("⚠️ [DEBUG] PDF text extraction failed:", pdfError.message);
    pdfContent = `Ho ricevuto un PDF di fisica da analizzare...`;
}

            // Inizializza la cronologia della conversazione
            this.conversationHistory = [
                {
                    role: "system",
                    content: systemPrompt
                },
                {
                    role: "user", 
                    content: `Ecco il contenuto del PDF di fisica da analizzare:

---CONTENUTO PDF---
${pdfContent.substring(0, 15000)} ${pdfContent.length > 15000 ? '...[testo troncato per lunghezza]' : ''}
---FINE CONTENUTO---

Analizza questo contenuto e inizia l'esame. Rispondi SOLO in JSON come da istruzioni.`
                }
            ];

            console.log('📡 [DEBUG] Sending request to ChatGPT with PDF content...');

            const response = await this.openai.chat.completions.create({
                model: "gpt-4o", // o "gpt-4" se hai accesso
                messages: this.conversationHistory,
                max_tokens: 2048,
                temperature: 0.7,
            });

            console.log('📥 [DEBUG] Raw ChatGPT result object:', JSON.stringify(response, null, 2));

            const responseText = response.choices[0]?.message?.content || "";
            console.log('📝 [DEBUG] Extracted response text:', responseText);
            console.log('📝 [DEBUG] Response text type:', typeof responseText);
            console.log('📝 [DEBUG] Response text length:', responseText.length);

            // Aggiungi la risposta dell'assistente alla cronologia
            this.conversationHistory.push({
                role: "assistant",
                content: responseText
            });

            const parsedResponse = this.parseResponse(responseText);
            this.isActive = true;

            return {
                success: true,
                mainTopic: parsedResponse.mainTopic || 'Fisica',
                initialQuestion: parsedResponse.message,
                totalItems: parsedResponse.progress.total
            };

        } catch (error) {
            console.error('❌ [DEBUG] ChatGPT session start failed:', error);
            console.error('❌ [DEBUG] Error stack:', error.stack);
            throw error;
        }
    }

    async sendMessage(text, images = []) {
        if (!this.isActive) {
            throw new Error('No active session');
        }

        try {
            console.log('📤 [DEBUG] Sending message to ChatGPT...');
            console.log('📤 [DEBUG] Text:', text);
            console.log('📤 [DEBUG] Images count:', images.length);

            // Prepara il contenuto del messaggio
            const messageContent = [];

            // Aggiungi il testo
            const imageInfo = images && images.length > 0 ? ` (con ${images.length} disegni allegati)` : '';
            messageContent.push({
                type: "text",
                text: `Studente risponde: "${text}"${imageInfo}. 

IMPORTANTE: Rispondi SEMPRE e SOLO con JSON valido nel formato:
{
  "type": "question",
  "message": "Il tuo messaggio",
  "progress": {"covered": X, "total": Y, "percentage": Z},
  "isComplete": false
}

Valuta e procedi con la prossima domanda.`
            });

            // Aggiungi immagini se presenti
            if (images && images.length > 0) {
                console.log('🖼️ [DEBUG] Processing images for ChatGPT...');
                for (let i = 0; i < images.length; i++) {
                    const imageData = images[i].includes(',') ? images[i] : `data:image/png;base64,${images[i]}`;
                    messageContent.push({
                        type: "image_url",
                        image_url: {
                            url: imageData,
                            detail: "high"
                        }
                    });
                    console.log(`✅ Image ${i + 1} processed for ChatGPT`);
                }
            }

            const userMessage = {
                role: "user",
                content: messageContent
            };

            this.conversationHistory.push(userMessage);

            console.log('📡 [DEBUG] Sending to ChatGPT with message history length:', this.conversationHistory.length);

            const response = await this.openai.chat.completions.create({
                model: "gpt-4o",
                messages: this.conversationHistory,
                max_tokens: 2048,
                temperature: 0.7,
            });

            console.log('📥 [DEBUG] Raw ChatGPT result for sendMessage:', JSON.stringify(response, null, 2));

            const responseText = response.choices[0]?.message?.content || "";
            console.log('📝 [DEBUG] Extracted response text from sendMessage:', responseText);
            console.log('📝 [DEBUG] Response text type:', typeof responseText);
            console.log('📝 [DEBUG] Response text length:', responseText.length);

            // Aggiungi la risposta dell'assistente alla cronologia
            this.conversationHistory.push({
                role: "assistant",
                content: responseText
            });

            return this.parseResponse(responseText);

        } catch (error) {
            console.error('❌ [DEBUG] ChatGPT message failed:', error);
            console.error('❌ [DEBUG] Error stack:', error.stack);
            throw error;
        }
    }

    parseResponse(aiResponse) {
        console.log('🔍 Raw AI Response:', aiResponse);

        try {
            let cleanedText = aiResponse;

            // Rimuovi markdown code blocks
            cleanedText = cleanedText.replace(/```json\s*/g, '').replace(/```\s*/g, '');

            // Rimuovi testo prima e dopo JSON
            cleanedText = cleanedText.replace(/^[^{]*/, '').replace(/[^}]*$/, '');

            let jsonString = null;

            // Strategia 1: match JSON completo
            const fullJsonMatch = cleanedText.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
            if (fullJsonMatch) {
                jsonString = fullJsonMatch[0];
            }

            // Strategia 2: se non trova, cerca dal primo { all'ultimo }
            if (!jsonString) {
                const firstBrace = cleanedText.indexOf('{');
                const lastBrace = cleanedText.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                    jsonString = cleanedText.substring(firstBrace, lastBrace + 1);
                }
            }

            if (jsonString) {
                jsonString = jsonString
                    .replace(/,\s*([}\]])/g, '$1') // rimuovi virgole finali
                    .replace(/\n/g, ' ')
                    .replace(/\r/g, '')
                    .replace(/\t/g, ' ')
                    .replace(/\\/g, '\\\\')
                    .trim();

                console.log('🧹 Cleaned JSON:', jsonString);

                try {
                    const parsed = JSON.parse(jsonString);

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
        const response = originalResponse.toLowerCase();

        let message = 'Continui la sua esposizione.';
        let type = 'question';
        let isComplete = false;

        if (response.includes('completo') || response.includes('finito') || response.includes('terminato')) {
            isComplete = true;
            type = 'completion';
            message = 'Esame completato. Ottimo lavoro!';
        } else if (response.includes('inizio') || response.includes('iniziamo') || response.includes('cominciamo')) {
            type = 'setup';
            message = 'Iniziamo l\'esame. Mi faccia una trattazione completa del materiale.';
        } else {
            const sentences = originalResponse.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
            if (sentences.length > 0) {
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
        this.conversationHistory = [];
        this.isActive = false;
        console.log('🔚 ChatGPT session ended');
    }
}

export default ConversationManager;