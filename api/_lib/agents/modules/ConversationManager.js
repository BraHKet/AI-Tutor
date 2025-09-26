// ==========================================
// FILE: src/agents/modules/ConversationManager.js
// VERSIONE AGGIORNATA: @google/genai + Gemini 2.5
// ==========================================

import { GoogleGenAI } from '@google/genai';
import { GoogleAuth } from 'google-auth-library';
import fs from 'fs';         // <-- AGGIUNGI QUESTA RIGA
import os from 'os';         // <-- AGGIUNGI QUESTA RIGA
import path from 'path';

export class ConversationManager {
    constructor() {
    // Questa logica di setup viene eseguita solo una volta quando il server si avvia.
    const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;
    if (credentialsJson) {
        // Vercel fornisce una directory temporanea scrivibile in /tmp
        const tempDir = os.tmpdir();
        const credentialsPath = path.join(tempDir, 'gcp-credentials.json');

        // Scriviamo il contenuto della variabile d'ambiente in un file temporaneo.
        fs.writeFileSync(credentialsPath, credentialsJson);

        // Diciamo alla libreria di Google: "Le credenziali si trovano in questo percorso!"
        process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
    }

    // Ora che l'ambiente è configurato correttamente, l'inizializzazione standard funziona.
    // La libreria troverà automaticamente il file che abbiamo appena creato.
    this.genAI = new GoogleGenAI({
        vertexai: true,
        project: process.env.GOOGLE_CLOUD_PROJECT,
        location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
    });

    this.chatSession = null;
    this.isActive = false;
}

    async startSession(pdfData) {

        console.log('🚀 [DEBUG] Starting session...');
console.log('🚀 [DEBUG] PDF data received:', {
    mimeType: pdfData.mimeType,
    dataLength: pdfData.data ? pdfData.data.length : 'NO DATA',
    hasData: !!pdfData.data
});

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
            // Creazione della "sessione chat" tramite il nuovo SDK
            const contents = [
    {
        role: "user",
        parts: [
            { inlineData: { mimeType: pdfData.mimeType, data: pdfData.data } },
            { text: "Analizza questo PDF e inizia l'esame. Rispondi SOLO in JSON come da istruzioni." }
        ]
    }
];


console.log('📡 [DEBUG] Sending request to Gemini with contents:', {
    partsCount: contents[0].parts.length,
    hasInlineData: !!contents[0].parts[0].inlineData,
    textPart: contents[0].parts[1].text
});

const result = await this.genAI.models.generateContent({
    model: "gemini-2.5-flash",       // <-- TORNATO AL TUO MODELLO ORIGINALE
    contents: contents,              // <-- ORA INVIAMO UN SOLO PACCO
    systemInstruction: systemPrompt, // Le istruzioni generali le mettiamo qui
    safetySettings: [],
});

console.log('📥 [DEBUG] Raw Gemini result object:', JSON.stringify(result, null, 2));

            // Parsing della risposta robusto
            const responseText = result.output_text || result[0]?.content?.text || "";
            const response = this.parseResponse(responseText);
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
        if (!this.isActive) {
            throw new Error('No active session');
        }

        try {
            const inputs = [];

            // Allego immagini se presenti
            if (images && images.length > 0) {
                for (const singleImage of images) {
                    console.log(`--- ---------------------- ---`);
                    console.log(
                        '%c ',
                        'font-size: 1px; ' +
                        'padding: 100px; ' +
                        'border: 1px solid black; ' +
                        'background: url(' + singleImage + ') no-repeat center center; ' +
                        'background-size: contain;'
                    );
                    console.log('--- FINE IMMAGINE ---');

                    const imageData = singleImage.split(',')[1];
                    inputs.push({ inlineData: { mimeType: 'image/png', data: imageData } });
                }
            }

            // Aggiungo testo dello studente
            const imageInfo = images && images.length > 0 ? ` (con ${images.length} disegni allegati)` : '';
            inputs.push({
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

            const result = await this.genAI.models.generateContent({
                model: "gemini-2.5-flash",
                contents: inputs,
                safetySettings: [],
            });

            const responseText = result.output_text || result[0]?.content?.text || "";
            return this.parseResponse(responseText);
        } catch (error) {
            console.error('❌ Message failed:', error);
            throw error;
        }
    }

    parseResponse(aiResponse) {
        console.log('🔍 Raw AI Response:', aiResponse);

        try {
            let cleanedText = aiResponse;

            // Rimuovo markdown code blocks
            cleanedText = cleanedText.replace(/```json\s*/g, '').replace(/```\s*/g, '');

            // Rimuovo testo prima e dopo JSON
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
                    .replace(/,\s*([}\]])/g, '$1') // rimuovo virgole finali
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
        this.chatSession = null;
        this.isActive = false;
    }
}

export default ConversationManager;
