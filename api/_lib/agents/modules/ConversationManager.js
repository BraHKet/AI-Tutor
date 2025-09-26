// ==========================================
// FILE: src/agents/modules/ConversationManager.js
// VERSIONE CORRETTA: Debug migliorato + gestione robusta delle risposte
// ==========================================

import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import os from 'os';
import path from 'path';

export class ConversationManager {
    constructor() {
        // Setup delle credenziali
        const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;
        if (credentialsJson) {
            const tempDir = os.tmpdir();
            const credentialsPath = path.join(tempDir, 'gcp-credentials.json');
            fs.writeFileSync(credentialsPath, credentialsJson);
            process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
        }

        this.genAI = new GoogleGenAI({
            vertexai: true,
            project: process.env.GOOGLE_CLOUD_PROJECT,
            location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
        });

        this.chatSession = null;
        this.isActive = false;
    }

    async startSession(pdfData) {
        const systemPrompt = `Tu sei un PROFESSORE UNIVERSITARIO di fisica durante un esame orale.

COMPITO:
1. Analizza questo PDF completamente
2. Identifica gli argomenti principali che lo studente deve conoscere
3. Gestisci l'esame fino al completamento

REGOLE IMPORTANTI:
- Fai domande specifiche sui contenuti del PDF
- Non dare suggerimenti o aiuti
- Mantieni un tono professionale da esaminatore
- Lo studente può rispondere con testo e/o disegni

FORMATO RISPOSTA OBBLIGATORIO:
Devi SEMPRE rispondere con un oggetto JSON nel seguente formato esatto:

{
  "type": "setup",
  "message": "La tua domanda o commento qui",
  "progress": {
    "covered": 0,
    "total": 10,
    "percentage": 0
  },
  "isComplete": false,
  "mainTopic": "Argomento principale del PDF"
}

IMPORTANTE: 
- Rispondi SOLO con il JSON, senza altro testo
- Non usare markdown o backticks
- Assicurati che il JSON sia valido
- Inizia sempre con type "setup" per la prima domanda`;

        try {
            console.log('🚀 Starting session with PDF data...');
            
            // Preparazione del contenuto per Gemini
            const contents = [{
                role: "user",
                parts: [
                    { 
                        inlineData: { 
                            mimeType: pdfData.mimeType, 
                            data: pdfData.data 
                        } 
                    },
                    { 
                        text: "Analizza questo PDF di fisica e inizia l'esame orale. Rispondi esclusivamente con il JSON nel formato richiesto." 
                    }
                ]
            }];

            console.log('📡 Sending request to Gemini...');
            
            const result = await this.genAI.getGenerativeModel({ 
                model: "gemini-2.0-flash-exp" // Prova con il modello più recente
            }).generateContent({
                contents: contents,
                systemInstruction: systemPrompt,
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 2048,
                },
                safetySettings: [
                    {
                        category: "HARM_CATEGORY_HARASSMENT",
                        threshold: "BLOCK_NONE"
                    },
                    {
                        category: "HARM_CATEGORY_HATE_SPEECH", 
                        threshold: "BLOCK_NONE"
                    },
                    {
                        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                        threshold: "BLOCK_NONE"
                    },
                    {
                        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                        threshold: "BLOCK_NONE"
                    }
                ]
            });

            console.log('📥 Raw response received:', result);
            
            // Estrazione del testo dalla risposta
            let responseText = '';
            if (result.response) {
                responseText = result.response.text();
            } else if (result.candidates && result.candidates[0]) {
                responseText = result.candidates[0].content.parts[0].text;
            } else {
                throw new Error('No response text found in Gemini result');
            }

            console.log('📝 Extracted response text:', responseText);

            // Parsing della risposta
            const response = this.parseResponse(responseText);
            this.isActive = true;

            return {
                success: true,
                mainTopic: response.mainTopic || 'Fisica',
                initialQuestion: response.message,
                totalItems: response.progress.total
            };

        } catch (error) {
            console.error('❌ Session start failed:', error);
            throw new Error(`Failed to start examination: ${error.message}`);
        }
    }

    async sendMessage(text, images = []) {
        if (!this.isActive) {
            throw new Error('No active session');
        }

        try {
            console.log('📤 Sending student message:', { text, imageCount: images.length });

            const parts = [];

            // Aggiungi immagini se presenti
            if (images && images.length > 0) {
                console.log(`🖼️ Processing ${images.length} images...`);
                for (let i = 0; i < images.length; i++) {
                    const imageData = images[i].includes(',') ? images[i].split(',')[1] : images[i];
                    parts.push({ 
                        inlineData: { 
                            mimeType: 'image/png', 
                            data: imageData 
                        } 
                    });
                    console.log(`✅ Image ${i + 1} processed`);
                }
            }

            // Aggiungi il testo
            const imageInfo = images && images.length > 0 ? ` (allegati ${images.length} disegni/formule)` : '';
            parts.push({
                text: `Risposta dello studente: "${text}"${imageInfo}

Valuta la risposta e procedi con la prossima domanda. Rispondi SOLO con JSON nel formato:
{
  "type": "question",
  "message": "La tua prossima domanda o valutazione",
  "progress": {"covered": X, "total": Y, "percentage": Z},
  "isComplete": false
}`
            });

            const result = await this.genAI.getGenerativeModel({ 
                model: "gemini-2.0-flash-exp" 
            }).generateContent({
                contents: [{ role: "user", parts }],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 2048,
                },
                safetySettings: [
                    {
                        category: "HARM_CATEGORY_HARASSMENT",
                        threshold: "BLOCK_NONE"
                    },
                    {
                        category: "HARM_CATEGORY_HATE_SPEECH", 
                        threshold: "BLOCK_NONE"
                    },
                    {
                        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                        threshold: "BLOCK_NONE"
                    },
                    {
                        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                        threshold: "BLOCK_NONE"
                    }
                ]
            });

            let responseText = '';
            if (result.response) {
                responseText = result.response.text();
            } else if (result.candidates && result.candidates[0]) {
                responseText = result.candidates[0].content.parts[0].text;
            }

            console.log('📝 AI response for student message:', responseText);

            return this.parseResponse(responseText);

        } catch (error) {
            console.error('❌ Send message failed:', error);
            return {
                type: 'error',
                message: 'Si è verificato un errore. Provi a ripetere la risposta.',
                progress: { covered: 0, total: 1, percentage: 0 },
                isComplete: false
            };
        }
    }

    parseResponse(aiResponse) {
        console.log('🔍 Raw AI Response:', aiResponse);
        console.log('🔍 Response length:', aiResponse.length);
        console.log('🔍 Response type:', typeof aiResponse);

        if (!aiResponse || typeof aiResponse !== 'string') {
            console.error('❌ Invalid response type or empty response');
            return this.createIntelligentFallback(aiResponse || '');
        }

        try {
            let cleanedText = aiResponse.trim();

            // Rimuovi markdown code blocks
            cleanedText = cleanedText.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
            
            // Rimuovi eventuali commenti o testo prima/dopo il JSON
            cleanedText = cleanedText.replace(/^[^{]*/, '').replace(/[^}]*$/, '');

            console.log('🧹 Cleaned text:', cleanedText);

            let jsonString = null;

            // Strategia 1: trova il JSON più completo possibile
            const jsonMatches = cleanedText.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
            if (jsonMatches && jsonMatches.length > 0) {
                // Prendi il JSON più lungo (probabilmente quello più completo)
                jsonString = jsonMatches.reduce((a, b) => a.length > b.length ? a : b);
                console.log('✅ Found JSON match:', jsonString);
            }

            // Strategia 2: se non trova nulla, prova a estrarre dal primo { all'ultimo }
            if (!jsonString) {
                const firstBrace = cleanedText.indexOf('{');
                const lastBrace = cleanedText.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                    jsonString = cleanedText.substring(firstBrace, lastBrace + 1);
                    console.log('🔄 Fallback JSON extraction:', jsonString);
                }
            }

            if (jsonString) {
                // Pulizia finale del JSON
                jsonString = jsonString
                    .replace(/,\s*([}\]])/g, '$1') // rimuovi virgole finali
                    .replace(/\n/g, ' ')
                    .replace(/\r/g, '')
                    .replace(/\t/g, ' ')
                    .trim();

                console.log('🎯 Final JSON string to parse:', jsonString);

                try {
                    const parsed = JSON.parse(jsonString);
                    console.log('✅ Successfully parsed JSON:', parsed);

                    const normalized = {
                        type: this.validateString(parsed.type, 'question'),
                        message: this.validateString(parsed.message, 'Continui la sua esposizione.'),
                        progress: this.validateProgress(parsed.progress),
                        isComplete: Boolean(parsed.isComplete),
                        mainTopic: this.validateString(parsed.mainTopic, undefined)
                    };

                    console.log('✅ Normalized response:', normalized);
                    return normalized;
                    
                } catch (parseError) {
                    console.error('❌ JSON Parse Error:', parseError);
                    console.error('❌ Failed JSON string:', jsonString);
                }
            }

            // Se arriviamo qui, il parsing è fallito
            console.error('❌ No valid JSON found in response');
            return this.createIntelligentFallback(aiResponse);

        } catch (error) {
            console.error('❌ Parse failed completely:', error);
            return this.createIntelligentFallback(aiResponse);
        }
    }

    validateString(value, defaultValue) {
        return (typeof value === 'string' && value.trim()) ? value.trim() : defaultValue;
    }

    validateProgress(progress) {
        if (!progress || typeof progress !== 'object') {
            return { covered: 0, total: 10, percentage: 0 };
        }

        const covered = Math.max(0, parseInt(progress.covered) || 0);
        const total = Math.max(1, parseInt(progress.total) || 10);
        const percentage = Math.min(100, Math.max(0, parseInt(progress.percentage) || Math.round((covered / total) * 100)));

        return { covered, total, percentage };
    }

    createIntelligentFallback(originalResponse) {
        console.log('🆘 Creating intelligent fallback for:', originalResponse.substring(0, 200) + '...');
        
        const response = originalResponse.toLowerCase();

        // Prova a estrarre informazioni utili dalla risposta anche se non è JSON
        let message = 'Mi parli degli argomenti trattati nel PDF.';
        let type = 'question';
        let isComplete = false;
        let mainTopic = 'Fisica';

        // Cerca pattern comuni
        if (response.includes('complet') || response.includes('finit') || response.includes('terminat')) {
            isComplete = true;
            type = 'completion';
            message = 'Esame completato. Ottimo lavoro!';
        } else if (response.includes('inizi') || response.includes('iniziam') || response.includes('cominciam')) {
            type = 'setup';
            message = 'Iniziamo l\'esame. Mi faccia una trattazione del materiale studiato.';
        } else {
            // Cerca frasi che sembrano domande
            const sentences = originalResponse.split(/[.!?]+/).filter(s => s.trim().length > 10);
            const questionSentence = sentences.find(s => 
                s.includes('?') || 
                s.toLowerCase().includes('può') || 
                s.toLowerCase().includes('spieg') ||
                s.toLowerCase().includes('descri') ||
                s.toLowerCase().includes('cosa')
            );
            
            if (questionSentence) {
                message = questionSentence.trim();
                if (!message.endsWith('?') && !message.endsWith('.')) {
                    message += '?';
                }
            }
        }

        const fallback = {
            type: type,
            message: message,
            progress: { covered: 1, total: 10, percentage: 10 },
            isComplete: isComplete,
            mainTopic: mainTopic
        };

        console.log('🆘 Fallback created:', fallback);
        return fallback;
    }

    endSession() {
        this.chatSession = null;
        this.isActive = false;
        console.log('🔚 Session ended');
    }
}

export default ConversationManager;