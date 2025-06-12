// ==========================================
// FILE: src/agents/modules/QuestionGenerator.js (VERSIONE COMPLETA E CORRETTA)
// ==========================================

import { GoogleGenerativeAI } from '@google/generative-ai';

export class QuestionGenerator {
    constructor(supabaseClient) { // Modificato per accettare la chiave API
        this.supabase = supabaseClient;
        
        this.genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        this.agentProfile = null;
    }

    async initialize(agentProfile) {
        this.agentProfile = agentProfile;
        console.log('❓ Question Generator initialized');
    }

    async generateOpeningRequest(topics, studentProfile, options = {}) {
        try {
            const selectedTopic = this.selectOptimalTopic(topics, studentProfile);
            const personality = options.personality;

            // Controllo di sicurezza per evitare errori se la personalità non viene passata
            if (!personality || !personality.name || !personality.description) {
                console.error("Invalid personality object received in generateOpeningRequest:", personality);
                throw new Error("A valid personality object is required to generate a request.");
            }

            const prompt = `Sei un professore di fisica ${personality.name} che sta per iniziare un esame orale.
La tua personalità è descritta come: "${personality.description}".

ARGOMENTO DA CHIEDERE: "${selectedTopic.topic_name}"
DIFFICOLTÀ ARGOMENTO: ${selectedTopic.difficulty_level}/10
PUNTI ESSENZIALI CHE LO STUDENTE DOVREBBE TRATTARE: ${JSON.stringify(selectedTopic.essential_points)}

Il tuo compito è formulare una domanda di apertura. Deve essere chiara, naturale e perfettamente in linea con la tua personalità. Invita lo studente a esporre l'argomento.

Restituisci la tua risposta ESCLUSIVAMENTE in formato JSON:
{
  "question": "La tua domanda di apertura, formulata con la personalità richiesta.",
  "strategy": "La strategia che hai usato (es. 'Inizio diretto e formale', 'Approccio amichevole e incoraggiante').",
  "estimatedDuration": ${selectedTopic.estimated_exposition_time || 10}
}`;
            
            const aiRequest = await this.generateAIResponse(prompt);

            // Aggiunto controllo sul risultato per evitare crash
            if (!aiRequest || !aiRequest.question) {
                console.warn("AI did not return a valid question object. Using fallback.");
                return this.getFallbackOpeningRequest(selectedTopic);
            }

            return {
                message: aiRequest.question,
                topic: selectedTopic,
                strategy: aiRequest.strategy,
                estimatedDuration: aiRequest.estimatedDuration,
            };
        } catch (error) {
            console.error('Failed to generate opening request:', error);
            return this.getFallbackOpeningRequest(topics[0]);
        }
    }

    async generateFollowUpQuestion(analysis, conversationContext, nextAction, personality) {
        try {
            const historyContext = conversationContext.turnHistory
                .slice(-4)
                .map(turn => `${turn.speaker?.toUpperCase()}: ${turn.content}`)
                .join('\n');

            // Controllo di sicurezza per risolvere "Cannot read properties of undefined (reading 'name')"
            if (!personality || !personality.name || !personality.description) {
                console.error("Invalid personality object received in generateFollowUpQuestion:", personality);
                throw new Error("A valid personality object is required to generate a follow-up.");
            }

            const prompt = `Sei un professore di fisica ${personality.name} (${personality.description}) che sta conducendo un esame orale. Devi formulare la prossima domanda o affermazione.

CONTESTO CONVERSAZIONE:
${historyContext}

ANALISI DELL'ULTIMA RISPOSTA DELLO STUDENTE:
- Punteggio Complessivo: ${analysis.overallScore}/100
- Errori Rilevati: ${JSON.stringify(analysis.technicalErrors)}
- Punti Mancanti: ${JSON.stringify(analysis.essentialPointsMissing)}
- Stato Emotivo Studente: ${analysis.studentEmotionalState}

AZIONE STRATEGICA DA INTRAPRENDERE: ${nextAction.type} (${nextAction.reason})
PERSONALITÀ DA MANTENERE: ${personality.name}

Formula la prossima domanda o affermazione in modo naturale e colloquiale. Deve implementare l'azione strategica e mantenere la tua personalità. Ad esempio, se devi fornire una guida a uno studente bloccato e sei un professore 'gentile', il tuo tono sarà rassicurante. Se sei 'severo', sarai più diretto.

Restituisci la tua risposta ESCLUSIVAMENTE in formato JSON:
{
  "question": "La tua domanda/affermazione esatta.",
  "type": "${nextAction.type}",
  "strategy": "La strategia specifica che hai usato (es. 'Domanda mirata su un punto debole', 'Incoraggiamento per sblocco').",
  "difficulty": "easy|medium|hard",
  "expectedResponse": "Descrivi brevemente cosa ti aspetti che lo studente risponda."
}`;

            const followUpData = await this.generateAIResponse(prompt);
            
            // Aggiunto controllo sul risultato per evitare crash
            if (!followUpData || !followUpData.question) {
                console.warn("AI did not return a valid follow-up object. Using fallback.");
                return this.getFallbackFollowUp(analysis);
            }

            return {
                message: followUpData.question,
                type: followUpData.type,
                strategy: followUpData.strategy,
                expectedResponse: followUpData.expectedResponse,
                difficulty: followUpData.difficulty,
            };
        } catch (error) {
            console.error('Failed to generate follow-up:', error);
            return this.getFallbackFollowUp(analysis);
        }
    }

    // Correzione per risolvere il "ReferenceError: Cannot access 'response' before initialization"
    async generateAIResponse(prompt) {
        try {
            // 1. Esegui la chiamata a Gemini e attendi il risultato
            const result = await this.model.generateContent(prompt);
            
            // 2. Estrai l'oggetto 'response' dal risultato
            const response = await result.response;
            
            // 3. Estrai il testo dall'oggetto 'response'
            const text = response.text();
            
            // 4. Ora procedi con il parsing del testo
            let cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                cleanedText = jsonMatch[0];
                return JSON.parse(cleanedText);
            } else {
                throw new Error("No JSON object could be found in the AI response.");
            }
        } catch (error) {
            console.error('Failed to generate or parse AI response:', error);
            return {
                question: "Molto interessante, prosegua pure.",
                strategy: "fallback_continuation",
                type: "follow_up"
            };
        }
    }

    selectOptimalTopic(topics, studentProfile) {
        const studentLevel = studentProfile?.physics_knowledge_level || 5;
        const suitableTopics = topics.filter(topic => 
            topic && typeof topic.difficulty_level === 'number' && Math.abs(topic.difficulty_level - studentLevel) <= 2
        );
        return suitableTopics.length > 0 ? suitableTopics[0] : topics[0];
    }

    getFallbackOpeningRequest(topic) {
        return {
            message: `Mi parli di ${topic?.topic_name || 'fisica generale'}.`,
            topic: topic,
            requestType: 'basic_exposition',
            estimatedDuration: 10,
            strategy: 'standard_fallback'
        };
    }

    getFallbackFollowUp(analysis) {
        let message = "Può approfondire questo punto?";
        // Aggiunto controllo per evitare errori se analysis o essentialPointsMissing non esistono
        if (analysis && Array.isArray(analysis.essentialPointsMissing) && analysis.essentialPointsMissing.length > 0) {
            message = `Bene, ora parliamo di: ${analysis.essentialPointsMissing[0]}.`;
        }
        return {
            message: message,
            type: 'follow_up',
            strategy: 'continuation_fallback',
            difficulty: 'medium'
        };
    }
}

export default QuestionGenerator;