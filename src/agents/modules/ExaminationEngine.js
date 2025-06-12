// ==========================================
// FILE: src/agents/modules/ExaminationEngine.js (100% COMPLETO)
// ==========================================

import { GoogleGenerativeAI } from '@google/generative-ai';

export class ExaminationEngine {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
        this.agentProfile = null;
        this.currentSessionId = null;
        
        this.evaluationWeights = {
            completeness: 0.25,
            technicalAccuracy: 0.30,
            conceptualUnderstanding: 0.25,
            logicalFlow: 0.20
        };
    }

    async initialize(agentProfile) {
        this.agentProfile = agentProfile;
        console.log('🎓 Examination Engine initialized');
    }

    async analyzeStudentResponse(response, currentTopic, conversationHistory) {
        try {
            const analysisPrompt = this.buildAnalysisPrompt(response, currentTopic, conversationHistory);
            
            const result = await this.model.generateContent(analysisPrompt);
            const aiResponse = await result.response;
            const analysisText = aiResponse.text();
            
            const analysis = this.parseResponseAnalysis(analysisText);
            
            await this.storeResponseAnalysis(response, analysis, currentTopic);
            
            return analysis;
        } catch (error) {
            console.error('Response analysis failed:', error);
            return this.getFallbackAnalysis();
        }
    }

    buildAnalysisPrompt(response, currentTopic, conversationHistory) {
        const historyContext = conversationHistory
            .slice(-3) // Last 3 exchanges for context
            .map(turn => `${turn.speaker?.toUpperCase()}: ${turn.content}`)
            .join('\n');

        return `Sei un esperto professore di fisica che sta valutando la risposta di uno studente durante un esame orale.

ARGOMENTO CORRENTE: ${currentTopic?.topic_name || 'Fisica generale'}
AREA FISICA: ${currentTopic?.physics_area || 'generale'}
PUNTI ESSENZIALI RICHIESTI: ${JSON.stringify(currentTopic?.essential_points || [])}
DIFFICOLTÀ ARGOMENTO: ${currentTopic?.difficulty_level || 5}/10

CONTESTO CONVERSAZIONE:
${historyContext}

RISPOSTA STUDENTE DA ANALIZZARE:
"${response}"

ANALIZZA LA RISPOSTA valutando:
1. COMPLETEZZA: Quanto copre dei punti essenziali richiesti?
2. ACCURATEZZA TECNICA: Errori di fisica, matematica, formule?
3. COMPRENSIONE CONCETTUALE: Dimostra vera comprensione?
4. FLUSSO LOGICO: Presentazione chiara e organizzata?

Rispondi in questo formato JSON:

{
  "understandingLevel": "excellent|good|basic|poor",
  "completeness": 85,
  "technicalAccuracy": 75,
  "conceptualUnderstanding": 80,
  "logicalFlow": 70,
  "overallScore": 77,
  "essentialPointsCovered": ["punto1", "punto2"],
  "essentialPointsMissing": ["punto3"],
  "technicalErrors": [
    {
      "error": "Ha confuso energia cinetica con potenziale",
      "severity": "medium"
    }
  ],
  "strengths": ["Ottima conoscenza delle formule"],
  "studentEmotionalState": "confident|uncertain|blocked|frustrated",
  "recommendedNextAction": "follow_up_question|clarification_needed|move_to_next_topic",
  "confidenceInEvaluation": 0.85
}`;
    }

    parseResponseAnalysis(analysisText) {
        try {
            let cleanedText = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                let jsonString = jsonMatch[0];
                // Tentativo di correggere comuni errori JSON come virgole finali
                jsonString = jsonString.replace(/,\s*(\]|})/g, '$1');
                const analysis = JSON.parse(jsonString);
                return this.validateAndNormalizeAnalysis(analysis);
            }
            throw new Error("No JSON object found in AI response.");
        } catch (error) {
            console.error('Failed to parse analysis JSON:', error, "Raw text:", analysisText);
            return this.getFallbackAnalysis();
        }
    }

    validateAndNormalizeAnalysis(analysis) {
        const defaults = {
            understandingLevel: 'basic',
            completeness: 50,
            technicalAccuracy: 50,
            conceptualUnderstanding: 50,
            logicalFlow: 50,
            overallScore: 50,
            essentialPointsCovered: [],
            essentialPointsMissing: [],
            technicalErrors: [],
            strengths: [],
            studentEmotionalState: 'uncertain',
            recommendedNextAction: 'follow_up_question',
            confidenceInEvaluation: 0.7
        };

        const normalized = { ...defaults, ...analysis };
        
        ['completeness', 'technicalAccuracy', 'conceptualUnderstanding', 'logicalFlow', 'overallScore'].forEach(field => {
            normalized[field] = Math.max(0, Math.min(100, normalized[field] || 0));
        });
        
        if (!analysis.overallScore) {
            normalized.overallScore = Math.round(
                normalized.completeness * this.evaluationWeights.completeness +
                normalized.technicalAccuracy * this.evaluationWeights.technicalAccuracy +
                normalized.conceptualUnderstanding * this.evaluationWeights.conceptualUnderstanding +
                normalized.logicalFlow * this.evaluationWeights.logicalFlow
            );
        }
        
        return normalized;
    }

    async determineNextAction(analysis, conversationContext) {
        if (analysis.studentEmotionalState === 'blocked' || analysis.overallScore < 40) {
            return {
                type: 'provide_guidance',
                urgency: 'high',
                strategy: 'supportive_hint',
                reason: 'Student appears blocked or struggling significantly'
            };
        }
        if (analysis.essentialPointsMissing.length > 0 && analysis.overallScore >= 60) {
            return {
                type: 'follow_up_question',
                urgency: 'medium', 
                strategy: 'targeted_clarification',
                reason: 'Need to cover missing essential points',
                focusAreas: analysis.essentialPointsMissing
            };
        }
        if (analysis.overallScore >= 80) {
            return {
                type: 'advanced_challenge',
                urgency: 'low',
                strategy: 'deep_exploration',
                reason: 'Student ready for advanced concepts'
            };
        }
        return {
            type: 'continue_conversation',
            urgency: 'low',
            strategy: 'natural_flow',
            reason: 'Maintain natural conversation flow'
        };
    }

    async generateFinalEvaluation(conversationHistory, session) {
        try {
            const evaluationPrompt = this.buildFinalEvaluationPrompt(conversationHistory, session);
            
            const result = await this.model.generateContent(evaluationPrompt);
            const aiResponse = await result.response;
            const evaluationText = aiResponse.text();
            
            const evaluation = this.parseFinalEvaluation(evaluationText);
            
            evaluation.sessionId = session.id;
            evaluation.totalDuration = this.calculateSessionDuration(session);
            evaluation.totalTurns = conversationHistory.length;
            evaluation.evaluationTimestamp = new Date().toISOString();
            
            return evaluation;
        } catch (error) {
            console.error('Final evaluation failed:', error);
            return this.getFallbackFinalEvaluation();
        }
    }

    buildFinalEvaluationPrompt(conversationHistory, session) {
        const fullConversation = conversationHistory
            .map(turn => `${turn.speaker?.toUpperCase()}: ${turn.content}`)
            .join('\n\n');

        return `Sei un professore di fisica universitaria che deve dare una valutazione finale di un esame orale.

CONVERSAZIONE COMPLETA:
${fullConversation.slice(0, 4000)}

GENERA UNA VALUTAZIONE FINALE considerando:
1. PERFORMANCE GLOBALE: Valutazione complessiva 0-100
2. VOTO RACCOMANDATO: Voto finale suggerito (18-30)
3. PUNTI DI FORZA: Cosa ha fatto bene lo studente
4. AREE DI MIGLIORAMENTO: Lacune e debolezze identificate

Rispondi in questo formato JSON:

{
  "overallScore": 82,
  "gradeRecommendation": "26/30",
  "strengths": [
    "Eccellente comprensione dei principi fondamentali",
    "Esposizione chiara e organizzata"
  ],
  "weaknesses": [
    "Alcune imprecisioni nei calcoli numerici"
  ],
  "studyRecommendations": [
    "Ripassare le applicazioni pratiche",
    "Esercitarsi con più problemi numerici"
  ],
  "feedback": {
    "positive": "Dimostra una solida comprensione teorica",
    "constructive": "Lavora sulle applicazioni pratiche",
    "encouragement": "Hai una buona base per continuare"
  },
  "engagementScore": 85
}`;
    }

    parseFinalEvaluation(evaluationText) {
        try {
            let cleanedText = evaluationText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                let jsonString = jsonMatch[0].replace(/,\s*(\]|})/g, '$1');
                const evaluation = JSON.parse(jsonString);
                return this.validateFinalEvaluation(evaluation);
            }
            throw new Error("No JSON object found in final evaluation response.");
        } catch (error) {
            console.error('Failed to parse final evaluation:', error);
            return this.getFallbackFinalEvaluation();
        }
    }

    validateFinalEvaluation(evaluation) {
        const defaults = {
            overallScore: 70,
            gradeRecommendation: "22/30",
            strengths: ["Partecipazione attiva"],
            weaknesses: ["Alcune aree da migliorare"],
            studyRecommendations: ["Continuare a studiare"],
            feedback: {
                positive: "Buona partecipazione all'esame",
                constructive: "Continua a studiare per migliorare",
                encouragement: "Con impegno puoi migliorare"
            },
            engagementScore: 70
        };

        return { ...defaults, ...evaluation };
    }

    async storeResponseAnalysis(response, analysis, topic) {
        try {
            const { error } = await this.supabase
                .from('understanding_assessments')
                .insert({
                    session_id: this.currentSessionId,
                    concept_name: topic?.topic_name || 'General Physics',
                    understanding_level: analysis.understandingLevel,
                    evidence_from_conversation: {
                        student_response: response,
                        analysis_result: analysis
                    },
                    needs_reinforcement: analysis.overallScore < 60,
                    misconceptions_detected: analysis.technicalErrors,
                    confidence_in_assessment: analysis.confidenceInEvaluation
                });

            if (error) {
                console.error('Failed to store analysis:', error);
            }
        } catch (error) {
            console.error('Error storing response analysis:', error);
        }
    }

    calculateSessionDuration(session) {
        if (session.end_time && session.start_time) {
            const start = new Date(session.start_time);
            const end = new Date(session.end_time);
            return Math.round((end - start) / (1000 * 60)); // minutes
        }
        return 0;
    }

    getFallbackAnalysis() {
        return {
            understandingLevel: 'basic',
            completeness: 50,
            technicalAccuracy: 50,
            conceptualUnderstanding: 50,
            logicalFlow: 50,
            overallScore: 50,
            essentialPointsCovered: [],
            essentialPointsMissing: [],
            technicalErrors: [],
            strengths: ['Partecipazione'],
            studentEmotionalState: 'uncertain',
            recommendedNextAction: 'follow_up_question',
            confidenceInEvaluation: 0.5
        };
    }

    getFallbackFinalEvaluation() {
        return {
            overallScore: 70,
            gradeRecommendation: "22/30",
            strengths: ["Partecipazione attiva"],
            weaknesses: ["Alcune aree da migliorare"],
            studyRecommendations: ["Continuare a studiare"],
            feedback: {
                positive: "Ha partecipato attivamente all'esame",
                constructive: "Continui a studiare per consolidare le conoscenze",
                encouragement: "Con l'impegno costante può sicuramente migliorare"
            },
            engagementScore: 70
        };
    }

    setCurrentSession(sessionId) {
        this.currentSessionId = sessionId;
    }
}

export default ExaminationEngine;