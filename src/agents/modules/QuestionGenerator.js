// ==========================================
// FILE: src/agents/modules/QuestionGenerator.js (NUOVA LOGICA BASATA SU TESTO)
// ==========================================

import { GoogleGenerativeAI } from '@google/generative-ai';

export class QuestionGenerator {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    }

    async initialize(agentProfile) {
        this.agentProfile = agentProfile;
        console.log('❓ Question Generator initialized for text-based questions');
    }

    // NUOVA LOGICA: Genera una domanda di apertura basata sull'inizio del testo
    async generateOpeningRequest(pdfText, personality) {
        const textSnippet = pdfText.slice(0, 2000); // Usa l'inizio del testo per il contesto

        const prompt = `Sei un professore di fisica Adattivo (${personality.description}).
Stai iniziando un esame orale basato ESCLUSIVAMENTE sul seguente materiale di studio. Non fare domande sulla tua conoscenza generale, ma solo su ciò che è scritto qui.

INIZIO DEL MATERIALE DI STUDIO:
"""
${textSnippet}
"""

Formula una domanda di apertura che inviti lo studente a iniziare a esporre il contenuto del documento, partendo dal primo argomento trattato. La tua domanda deve essere naturale e in linea con la tua personalità.

Restituisci la tua risposta ESCLUSIVAMENTE in formato JSON:
{
  "question": "La tua domanda di apertura."
}`;

        const aiResponse = await this.generateAIResponse(prompt);
        return {
            message: aiResponse.question || "Buongiorno. Può iniziare a esporre il contenuto del materiale che ha studiato, partendo dall'inizio?",
        };
    }

    // NUOVA LOGICA: Genera un follow-up basato sulla risposta e sul contesto del PDF
    async generateFollowUpQuestion(analysis, conversationHistory, pdfText, personality) {
        const studentResponse = conversationHistory[conversationHistory.length - 1].content;
        
        // Semplice ricerca di contesto nel PDF (versione semplificata di RAG)
        const contextSnippet = this.findRelevantSnippet(studentResponse, pdfText);

        const prompt = `Sei un professore di fisica Adattivo (${personality.description}). Stai conducendo un esame orale basato ESCLUSIVAMENTE sul materiale fornito.

ANALISI DELLA RISPOSTA DELLO STUDENTE:
- Livello Comprensione: ${analysis.understandingLevel}
- Errori Tecnici: ${JSON.stringify(analysis.technicalErrors.map(e => e.error))}
- Punti di Forza: ${JSON.stringify(analysis.strengths)}

CONTESTO RILEVANTE DAL MATERIALE DI STUDIO:
"""
${contextSnippet}
"""

Basandoti sull'analisi della risposta dello studente e SUL CONTESTO DEL MATERIALE DI STUDIO, formula una domanda di approfondimento. Puoi chiedere di chiarire un punto, correggere un errore, o collegare il concetto a un'altra parte del testo fornito. Sii fedele al materiale.

Restituisci la tua risposta ESCLUSIVAMENTE in formato JSON:
{
  "question": "La tua domanda di follow-up."
}`;
        
        const aiResponse = await this.generateAIResponse(prompt);
        return {
            message: aiResponse.question || "Interessante. Può fornirmi maggiori dettagli basandosi sul testo?",
            type: 'follow_up',
        };
    }
    
    // Helper per trovare un pezzo di testo rilevante (RAG molto semplificato)
    findRelevantSnippet(studentResponse, pdfText) {
        // Cerca la prima occorrenza di una parola chiave dalla risposta dello studente
        const keywords = studentResponse.split(' ').filter(w => w.length > 4);
        for (const keyword of keywords) {
            const index = pdfText.toLowerCase().indexOf(keyword.toLowerCase());
            if (index !== -1) {
                // Restituisce un frammento di testo attorno alla parola chiave trovata
                const start = Math.max(0, index - 500);
                const end = Math.min(pdfText.length, index + 500);
                return pdfText.slice(start, end);
            }
        }
        // Se non trova nulla, restituisce l'inizio del documento
        return pdfText.slice(0, 1000);
    }

    async generateAIResponse(prompt) {
        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            let cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            throw new Error("No JSON object found in AI response.");
        } catch (error) {
            console.error('Failed to generate or parse AI response:', error);
            return { question: "Potrebbe ripetere o elaborare meglio, per favore?" };
        }
    }
}

export default QuestionGenerator;