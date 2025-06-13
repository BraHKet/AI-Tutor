// ==========================================
// FILE: src/agents/modules/HolisticEvaluator.js (VERSIONE SEMPLIFICATA)
// ==========================================

import { GoogleGenerativeAI } from '@google/generative-ai';

export class HolisticEvaluator {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    }

    async initialize(agentProfile) {
        console.log('📊 HolisticEvaluator initialized (simplified)');
    }

    async evaluateResponseWithChecklist(evaluationData) {
        try {
            console.log('🔍 Evaluating response against specific checklist...');
            
            const { question, pdfData, mainTopic, userResponse, userImage, conversationHistory, contentChecklist, alreadyCovered } = evaluationData;
            
            // Valuta usando la checklist specifica
            const evaluation = await this.checkAgainstChecklist(
                question, 
                pdfData, 
                mainTopic, 
                userResponse,
                conversationHistory,
                contentChecklist,
                alreadyCovered,
                userImage // Passa anche l'immagine
            );
            
            console.log(`✅ Checklist evaluation complete - New items covered: ${evaluation.newlyCovered?.length || 0}`);
            
            return evaluation;
            
        } catch (error) {
            console.error('❌ Checklist evaluation failed:', error);
            return this.getFallbackChecklistEvaluation();
        }
    }

    async checkAgainstChecklist(question, pdfData, mainTopic, userResponse, conversationHistory, contentChecklist, alreadyCovered, userImage = null) {
        const conversationContext = conversationHistory
            .map(turn => `${turn.speaker.toUpperCase()}: ${turn.content}`)
            .join('\n');

        const checklistItems = [
            ...contentChecklist.mustCover,
            ...contentChecklist.formulas,
            ...contentChecklist.demonstrations,
            ...contentChecklist.experiments,
            ...contentChecklist.visualElements
        ];

        const alreadyCoveredList = alreadyCovered.join(', ') || 'Nessuno';

        const prompt = `Sei un professore che valuta se la risposta dello studente copre elementi specifici della CHECKLIST.

ARGOMENTO: ${mainTopic}

CHECKLIST COMPLETA da coprire:
${checklistItems.map((item, index) => `${index + 1}. ${item}`).join('\n')}

ELEMENTI GIÀ COPERTI nelle risposte precedenti:
${alreadyCoveredList}

RISPOSTA ATTUALE DELLO STUDENTE:
"${userResponse}"

${userImage ? 'IMPORTANTE: Lo studente ha anche allegato un disegno/formula. Analizza anche quello per identificare elementi della checklist.' : ''}

COMPITO SPECIFICO:
1. Identifica ESATTAMENTE quali elementi della checklist sono stati trattati in questa risposta (testo ${userImage ? '+ disegno' : ''})
2. Identifica quali elementi della checklist NON sono ancora stati trattati
3. Verifica se formule, dimostrazioni, esperimenti sono stati spiegati correttamente
4. ${userImage ? 'Se c\'è un disegno, verifica se contiene formule o diagrammi della checklist' : ''}

IMPORTANTE: Confronta la risposta con il PDF originale per verificare accuratezza.

Rispondi SOLO in formato JSON:

{
  "newlyCovered": [
    "Elemento checklist 1 coperto in questa risposta",
    "Elemento checklist 2 coperto in questa risposta"
  ],
  "stillMissing": [
    "Elemento checklist ancora mancante 1",
    "Elemento checklist ancora mancante 2"
  ],
  "isComplete": false,
  "accuracyIssues": [
    "Errore o imprecisione 1",
    "Errore o imprecisione 2"
  ],
  "completenessPercentage": 65,
  "nextPriority": [
    "Prossimo elemento più importante da coprire"
  ]${userImage ? ',\n  "drawingAnalysis": "Analisi del disegno fornito"' : ''}
}`;

        try {
            // Prepara i dati per Gemini
            const geminiInputs = [
                {
                    inlineData: {
                        mimeType: pdfData.mimeType,
                        data: pdfData.data
                    }
                }
            ];

            // Aggiungi l'immagine del disegno se presente
            if (userImage) {
                const imageData = userImage.split(',')[1]; // Rimuovi data:image/png;base64,
                geminiInputs.push({
                    inlineData: {
                        mimeType: 'image/png',
                        data: imageData
                    }
                });
            }

            geminiInputs.push({ text: prompt });

            const result = await this.model.generateContent(geminiInputs);
            const response = await result.response;
            const aiResponse = response.text();
            
            return this.parseChecklistEvaluation(aiResponse);
            
        } catch (error) {
            console.error('❌ AI checklist evaluation failed:', error);
            throw error;
        }
    }

    parseChecklistEvaluation(aiResponse) {
        try {
            const cleanedText = aiResponse
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();
                
            const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const jsonString = jsonMatch[0].replace(/,\s*(\]|})/g, '$1');
                const parsed = JSON.parse(jsonString);
                
                // Normalizza i dati
                return this.normalizeChecklistEvaluation(parsed);
            }
            throw new Error("No JSON found in checklist evaluation response");
        } catch (error) {
            console.error('❌ Failed to parse checklist evaluation:', error);
            throw error;
        }
    }

    normalizeChecklistEvaluation(evaluation) {
        return {
            newlyCovered: evaluation.newlyCovered || [],
            stillMissing: evaluation.stillMissing || [],
            isComplete: evaluation.isComplete || false,
            accuracyIssues: evaluation.accuracyIssues || [],
            completenessPercentage: Math.max(0, Math.min(100, evaluation.completenessPercentage || 0)),
            nextPriority: evaluation.nextPriority || [],
            drawingAnalysis: evaluation.drawingAnalysis || null
        };
    }

    getFallbackChecklistEvaluation() {
        console.log('🔄 Using fallback checklist evaluation');
        
        return {
            newlyCovered: [],
            stillMissing: ["Valutazione automatica non disponibile"],
            isComplete: false,
            accuracyIssues: [],
            completenessPercentage: 30,
            nextPriority: ["Continuare la trattazione"]
        };
    }

    async checkCompleteness(question, pdfData, mainTopic, userResponse, conversationHistory) {
        const conversationContext = conversationHistory
            .map(turn => `${turn.speaker.toUpperCase()}: ${turn.content}`)
            .join('\n');

        const prompt = `Sei un professore che deve valutare se la risposta dello studente copre TUTTO il contenuto del PDF.

ARGOMENTO PRINCIPALE: ${mainTopic}

DOMANDA FATTA: "${question}"

CONVERSAZIONE PRECEDENTE:
${conversationContext}

RISPOSTA ATTUALE DELLO STUDENTE: 
"${userResponse}"

COMPITO:
Confronta la risposta dello studente con il contenuto COMPLETO del PDF e verifica se:

1. FORMULE: Tutte le formule del PDF sono state menzionate/derivate?
2. SPIEGAZIONI: Tutti i concetti principali sono stati spiegati?
3. PASSAGGI: Tutti i passaggi logici/matematici sono stati coperti?
4. FUORI TEMA: L'utente è andato fuori tema rispetto al PDF?

Se mancano elementi importanti, elencali specificatamente.

Rispondi SOLO in formato JSON:

{
  "isComplete": true/false,
  "completenessPercentage": 85,
  "missingParts": [
    "Formula specifica mancante",
    "Concetto non spiegato",
    "Passaggio matematico omesso"
  ],
  "isOffTopic": true/false,
  "offTopicElements": [
    "Elemento fuori tema 1"
  ],
  "strongPoints": [
    "Aspetto ben coperto 1",
    "Aspetto ben coperto 2"
  ],
  "overallAssessment": "excellent|good|partial|insufficient"
}`;

        try {
            const result = await this.model.generateContent([
                {
                    inlineData: {
                        mimeType: pdfData.mimeType,
                        data: pdfData.data
                    }
                },
                { text: prompt }
            ]);

            const response = await result.response;
            const aiResponse = response.text();
            
            return this.parseEvaluation(aiResponse);
            
        } catch (error) {
            console.error('❌ AI evaluation failed:', error);
            throw error;
        }
    }

    parseEvaluation(aiResponse) {
        try {
            const cleanedText = aiResponse
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();
                
            const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const jsonString = jsonMatch[0].replace(/,\s*(\]|})/g, '$1');
                const parsed = JSON.parse(jsonString);
                
                // Normalizza i dati
                return this.normalizeEvaluation(parsed);
            }
            throw new Error("No JSON found in evaluation response");
        } catch (error) {
            console.error('❌ Failed to parse evaluation:', error);
            throw error;
        }
    }

    normalizeEvaluation(evaluation) {
        // Assicura che tutti i campi siano presenti e validi
        return {
            isComplete: evaluation.isComplete || false,
            completenessPercentage: Math.max(0, Math.min(100, evaluation.completenessPercentage || 0)),
            missingParts: evaluation.missingParts || [],
            isOffTopic: evaluation.isOffTopic || false,
            offTopicElements: evaluation.offTopicElements || [],
            strongPoints: evaluation.strongPoints || [],
            overallAssessment: evaluation.overallAssessment || 'insufficient'
        };
    }

    getFallbackEvaluation() {
        console.log('🔄 Using fallback evaluation');
        
        return {
            isComplete: false,
            completenessPercentage: 30,
            missingParts: ["Valutazione automatica non disponibile"],
            isOffTopic: false,
            offTopicElements: [],
            strongPoints: ["Partecipazione"],
            overallAssessment: 'partial'
        };
    }

    async generateFinalEvaluation(completedConversation) {
        try {
            console.log('🏁 Generating final evaluation...');
            
            const conversationText = completedConversation
                .map(turn => `${turn.speaker.toUpperCase()}: ${turn.content}`)
                .join('\n\n');

            const prompt = `Genera una valutazione finale di questo esame orale completo:

CONVERSAZIONE COMPLETA:
${conversationText}

Genera una valutazione finale con voto e commento costruttivo.

Rispondi SOLO in formato JSON:

{
  "finalGrade": "27/30",
  "gradeDescription": "Ottimo",
  "overallScore": 85,
  "strengths": [
    "Forza 1",
    "Forza 2"
  ],
  "improvements": [
    "Area di miglioramento 1"
  ],
  "finalComment": "Commento finale costruttivo e incoraggiante"
}`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const aiResponse = response.text();
            
            return this.parseFinalEvaluation(aiResponse);
            
        } catch (error) {
            console.error('❌ Final evaluation failed:', error);
            return this.getFallbackFinalEvaluation();
        }
    }

    parseFinalEvaluation(aiResponse) {
        try {
            const cleanedText = aiResponse
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();
                
            const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const jsonString = jsonMatch[0].replace(/,\s*(\]|})/g, '$1');
                return JSON.parse(jsonString);
            }
            throw new Error("No JSON found in final evaluation");
        } catch (error) {
            console.error('❌ Failed to parse final evaluation:', error);
            throw error;
        }
    }

    getFallbackFinalEvaluation() {
        return {
            finalGrade: "21/30",
            gradeDescription: "Sufficiente",
            overallScore: 65,
            strengths: ["Partecipazione attiva"],
            improvements: ["Maggiore approfondimento degli argomenti"],
            finalComment: "Ha partecipato all'esame dimostrando impegno. Con uno studio più approfondito può migliorare significativamente."
        };
    }
}

export default HolisticEvaluator;