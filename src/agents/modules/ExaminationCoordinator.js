// ==========================================
// FILE: src/agents/modules/ExaminationCoordinator.js (NUOVO APPROCCIO OLISTICO)
// ==========================================

import { GoogleGenerativeAI } from '@google/generative-ai';

export class ExaminationCoordinator {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        this.agentProfile = null;
        
        // Configurazione per il nuovo approccio
        this.examinationConfig = {
            initialTreatmentMode: true,
            followUpQuestionsMax: 3,
            minimumTreatmentLength: 200, // Parole minime per una trattazione
            deepDiveThreshold: 0.8, // Soglia per domande avanzate
            completenessThreshold: 0.7 // Soglia per considerare la trattazione completa
        };

        // Tipi di approfondimento possibili
        this.followUpTypes = {
            'missing_concepts': 'Concetti mancanti dalla trattazione',
            'formula_derivation': 'Derivazione di formule specifiche', 
            'practical_application': 'Applicazioni pratiche',
            'advanced_connections': 'Connessioni avanzate tra concetti',
            'problem_solving': 'Risoluzione di problemi',
            'conceptual_depth': 'Approfondimento concettuale'
        };
    }

    async initialize(agentProfile) {
        this.agentProfile = agentProfile;
        console.log('🎯 Examination Coordinator initialized (holistic approach)');
    }

    // Genera la domanda iniziale onnicomprensiva basata sul PDF
    async generateInitialTreatmentRequest(pdfData, personality) {
        try {
            console.log('📋 Generating initial comprehensive treatment request...');
            
            const prompt = this.buildInitialTreatmentPrompt(pdfData, personality);
            
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
            
            const parsedResponse = this.parseInitialResponse(aiResponse);
            
            console.log('✅ Initial treatment request generated successfully');
            
            return {
                message: parsedResponse.question,
                expectedElements: parsedResponse.expectedElements,
                evaluationCriteria: parsedResponse.evaluationCriteria,
                estimatedDuration: parsedResponse.estimatedDuration,
                type: 'comprehensive_treatment',
                metadata: {
                    pdfAnalysis: pdfData.analysisContext,
                    personality: personality.key,
                    generatedAt: new Date().toISOString()
                }
            };
            
        } catch (error) {
            console.warn('❌ AI initial request generation failed, using intelligent fallback:', error.message);
            return this.getIntelligentInitialRequest(pdfData, personality);
        }
    }

    buildInitialTreatmentPrompt(pdfData, personality) {
        const complexityLevel = pdfData.analysisContext.complexity;
        const hasVisualElements = pdfData.analysisContext.hasVisualElements;
        const contentTypes = pdfData.analysisContext.contentTypes.join(', ');
        
        return `Sei un professore universitario di fisica con personalità ${personality.name} (${personality.description}).

Stai per iniziare un esame orale. Hai davanti il PDF completo che lo studente ha studiato.

INFORMAZIONI SUL MATERIALE:
- Pagine totali: ${pdfData.analysisContext.totalPages}
- Complessità: ${complexityLevel}
- Contiene elementi visivi (grafici/formule): ${hasVisualElements}
- Tipi di contenuto: ${contentTypes}

APPROCCIO DELL'ESAME:
Questo è un esame "olistico" in cui lo studente deve fare una trattazione COMPLETA del materiale dall'inizio alla fine, includendo:
- Tutti i concetti teorici
- Tutte le formule e derivazioni presenti
- Spiegazione di grafici, diagrammi e immagini
- Connessioni tra i vari argomenti
- Esempi e applicazioni pratiche

COMPITO:
Genera una domanda di apertura che chieda allo studente di fare una trattazione completa e sistematica di tutto il contenuto del PDF. La domanda deve essere:
1. Chiara e onnicomprensiva
2. Adatta alla tua personalità di professore
3. Che richieda una esposizione organizzata dall'inizio alla fine
4. Che specifichi l'inclusione di formule, diagrammi e dimostrazioni

Rispondi ESCLUSIVAMENTE in formato JSON:

{
  "question": "La tua domanda di apertura completa",
  "expectedElements": [
    "Elemento 1 che ti aspetti nella trattazione",
    "Elemento 2 che ti aspetti",
    "Elemento 3 che ti aspetti"
  ],
  "evaluationCriteria": [
    "Criterio 1 di valutazione",
    "Criterio 2 di valutazione", 
    "Criterio 3 di valutazione"
  ],
  "estimatedDuration": "Tempo stimato in minuti per la trattazione completa"
}`;
    }

    parseInitialResponse(aiResponse) {
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
            throw new Error("No JSON found in AI response");
        } catch (error) {
            console.error('❌ Failed to parse initial response:', error);
            throw new Error(`Response parsing failed: ${error.message}`);
        }
    }

    // Analizza la trattazione dello studente e decide se servono approfondimenti
    async analyzeTreatmentAndDecideNext(studentTreatment, pdfData, initialRequest, conversationHistory) {
        try {
            console.log('🔍 Analyzing student treatment for completeness...');
            
            // Controllo preliminare: se la risposta è chiaramente di test o molto breve, usa fallback immediato
            const wordCount = studentTreatment.trim().split(' ').length;
            if (wordCount < 5 || /^[x]+$/i.test(studentTreatment.trim())) {
                console.log('🔄 Using quick fallback for test/short response');
                return this.getQuickFallbackAnalysis(studentTreatment, conversationHistory);
            }
            
            const analysisPrompt = this.buildTreatmentAnalysisPrompt(
                studentTreatment, 
                pdfData, 
                initialRequest,
                conversationHistory
            );
            
            const result = await this.model.generateContent([
                {
                    inlineData: {
                        mimeType: pdfData.mimeType,
                        data: pdfData.data
                    }
                },
                { text: analysisPrompt }
            ]);
            
            const response = await result.response;
            const aiResponse = response.text();
            
            const analysis = this.parseTratatmentAnalysis(aiResponse);
            
            // Decide la prossima azione basata sull'analisi
            const nextAction = this.decideNextAction(analysis, conversationHistory);
            
            console.log(`📊 Treatment analysis completed. Next action: ${nextAction.type}`);
            
            return {
                analysis: analysis,
                nextAction: nextAction,
                treatmentQuality: analysis.overallCompleteness,
                readyForEvaluation: nextAction.type === 'final_evaluation'
            };
            
        } catch (error) {
            console.warn('❌ AI analysis failed, using comprehensive fallback:', error.message);
            return this.getComprehensiveFallbackAnalysis(studentTreatment, conversationHistory);
        }
    }

    buildTreatmentAnalysisPrompt(studentTreatment, pdfData, initialRequest, conversationHistory) {
        const conversationContext = conversationHistory
            .slice(-2)
            .map(turn => `${turn.speaker?.toUpperCase()}: ${turn.content}`)
            .join('\n');

        return `Sei un professore universitario che sta valutando una trattazione completa di uno studente.

HAI CHIESTO: "${initialRequest.message}"

ELEMENTI ATTESI: ${JSON.stringify(initialRequest.expectedElements)}

CONVERSAZIONE PRECEDENTE:
${conversationContext}

TRATTAZIONE DELLO STUDENTE:
"${studentTreatment}"

ANALISI RICHIESTA:
Confronta la trattazione dello studente con il contenuto completo del PDF. Valuta:

1. COMPLETEZZA CONTENUTISTICA (0-100%):
   - Ha coperto tutti gli argomenti principali?
   - Ha incluso tutte le formule importanti?
   - Ha spiegato grafici e diagrammi presenti?

2. ACCURATEZZA TECNICA (0-100%):
   - Le formule sono corrette?
   - I concetti sono spiegati accuratamente?
   - Ci sono errori tecnici significativi?

3. ORGANIZZAZIONE E FLUSSO (0-100%):
   - La trattazione segue un ordine logico?
   - Le connessioni tra concetti sono chiare?
   - L'esposizione è strutturata?

4. PROFONDITÀ DI COMPRENSIONE (0-100%):
   - Mostra comprensione profonda oltre la memorizzazione?
   - Spiega il "perché" oltre al "cosa"?
   - Fa connessioni concettuali appropriate?

IDENTIFICAZIONE LACUNE:
- Quali argomenti importanti mancano completamente?
- Quali formule/derivazioni non sono state trattate?
- Quali concetti necessitano approfondimento?

Rispondi SOLO in formato JSON:

{
  "overallCompleteness": 85,
  "contentCoverage": 80,
  "technicalAccuracy": 90,
  "organizationFlow": 85,
  "conceptualDepth": 75,
  "missingElements": [
    "Argomento importante mancante 1",
    "Formula non derivata 2",
    "Concetto non approfondito 3"
  ],
  "technicalErrors": [
    {
      "error": "Descrizione errore specifico",
      "severity": "low|medium|high",
      "location": "Dove nell'esposizione"
    }
  ],
  "strengths": [
    "Punto forte 1",
    "Punto forte 2"
  ],
  "improvementAreas": [
    "Area di miglioramento 1", 
    "Area di miglioramento 2"
  ],
  "readyForAdvanced": true,
  "recommendedFollowUp": "missing_concepts|formula_derivation|practical_application|advanced_connections|none",
  "estimatedComprehension": "excellent|good|basic|poor"
}`;
    }

    parseTratatmentAnalysis(aiResponse) {
        try {
            const cleanedText = aiResponse
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();
                
            const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const jsonString = jsonMatch[0].replace(/,\s*(\]|})/g, '$1');
                const parsed = JSON.parse(jsonString);
                
                // Normalizza i punteggi
                const normalizedAnalysis = this.normalizeAnalysisScores(parsed);
                return normalizedAnalysis;
            }
            throw new Error("No JSON found in treatment analysis");
        } catch (error) {
            console.error('❌ Failed to parse treatment analysis:', error);
            throw new Error(`Analysis parsing failed: ${error.message}`);
        }
    }

    normalizeAnalysisScores(analysis) {
        const scoreFields = ['overallCompleteness', 'contentCoverage', 'technicalAccuracy', 'organizationFlow', 'conceptualDepth'];
        
        scoreFields.forEach(field => {
            if (typeof analysis[field] === 'number') {
                analysis[field] = Math.max(0, Math.min(100, analysis[field]));
            } else {
                analysis[field] = 50; // Default fallback
            }
        });
        
        // Assicura che ci siano array vuoti se mancanti
        analysis.missingElements = analysis.missingElements || [];
        analysis.technicalErrors = analysis.technicalErrors || [];
        analysis.strengths = analysis.strengths || [];
        analysis.improvementAreas = analysis.improvementAreas || [];
        
        return analysis;
    }

    decideNextAction(analysis, conversationHistory) {
        const completeness = analysis.overallCompleteness;
        const missingElementsCount = analysis.missingElements.length;
        const hasHighSeverityErrors = analysis.technicalErrors.some(e => e.severity === 'high');
        const followUpCount = conversationHistory.filter(turn => 
            turn.metadata?.type === 'follow_up_question'
        ).length;

        // Se ci sono errori gravi, correggi prima
        if (hasHighSeverityErrors) {
            return {
                type: 'correction_needed',
                reason: 'High severity technical errors detected',
                focus: analysis.technicalErrors.filter(e => e.severity === 'high'),
                urgency: 'high'
            };
        }

        // Se la trattazione è molto incompleta
        if (completeness < 60 || missingElementsCount > 3) {
            return {
                type: 'request_completion',
                reason: 'Treatment significantly incomplete',
                missingElements: analysis.missingElements,
                urgency: 'high'
            };
        }

        // Se abbiamo già fatto troppi follow-up
        if (followUpCount >= this.examinationConfig.followUpQuestionsMax) {
            return {
                type: 'final_evaluation',
                reason: 'Maximum follow-up questions reached',
                urgency: 'low'
            };
        }

        // Se la trattazione è molto buona, procedi alla valutazione
        if (completeness >= 85 && missingElementsCount <= 1) {
            return {
                type: 'final_evaluation',
                reason: 'Treatment comprehensive and accurate',
                urgency: 'low'
            };
        }

        // Se ci sono alcuni elementi mancanti ma la base è buona
        if (completeness >= 70 && missingElementsCount <= 2) {
            return {
                type: 'targeted_follow_up',
                reason: 'Good treatment with minor gaps',
                followUpType: analysis.recommendedFollowUp || 'missing_concepts',
                missingElements: analysis.missingElements,
                urgency: 'medium'
            };
        }

        // Default: chiedi approfondimento
        return {
            type: 'general_follow_up',
            reason: 'Treatment needs some improvement',
            followUpType: analysis.recommendedFollowUp || 'conceptual_depth',
            urgency: 'medium'
        };
    }

    // Genera domande di approfondimento mirate
    async generateFollowUpQuestion(analysis, pdfData, nextAction, personality, conversationHistory) {
        try {
            console.log(`🎯 Generating follow-up question: ${nextAction.type}`);
            
            const prompt = this.buildFollowUpPrompt(analysis, pdfData, nextAction, personality, conversationHistory);
            
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
            
            const parsedQuestion = this.parseFollowUpQuestion(aiResponse);
            
            return {
                message: parsedQuestion.question,
                type: 'follow_up_question',
                followUpType: nextAction.followUpType,
                targetedElements: parsedQuestion.targetedElements,
                expectedDepth: parsedQuestion.expectedDepth,
                metadata: {
                    basedOnAnalysis: analysis,
                    actionType: nextAction.type,
                    generatedAt: new Date().toISOString()
                }
            };
            
        } catch (error) {
            console.warn('❌ AI follow-up generation failed, using intelligent fallback:', error.message);
            return this.getIntelligentFollowUpQuestion(nextAction, personality, analysis);
        }
    }

    buildFollowUpPrompt(analysis, pdfData, nextAction, personality, conversationHistory) {
        const missingElements = analysis.missingElements.join(', ');
        const actionDescription = this.followUpTypes[nextAction.followUpType] || 'Approfondimento generale';
        
        return `Sei un professore universitario di fisica con personalità ${personality.name}.

SITUAZIONE:
Lo studente ha appena completato una trattazione del materiale con questi risultati:
- Completezza: ${analysis.overallCompleteness}%
- Accuratezza tecnica: ${analysis.technicalAccuracy}%
- Elementi mancanti: ${missingElements}

AZIONE RICHIESTA: ${nextAction.type}
TIPO DI APPROFONDIMENTO: ${actionDescription}

ELEMENTI SPECIFICI DA APPROFONDIRE:
${nextAction.missingElements ? nextAction.missingElements.join('\n- ') : 'Approfondimento generale'}

ERRORI DA CORREGGERE:
${nextAction.focus ? nextAction.focus.map(e => e.error).join('\n- ') : 'Nessun errore grave'}

COMPITO:
Genera una domanda di approfondimento specifica che:
1. Sia mirata agli elementi mancanti o da correggere
2. Rifletta la tua personalità di professore
3. Richieda una risposta dettagliata e tecnica
4. Faccia riferimento al contenuto specifico del PDF

Rispondi SOLO in formato JSON:

{
  "question": "La tua domanda di approfondimento specifica",
  "targetedElements": [
    "Elemento specifico 1 che la domanda dovrebbe coprire",
    "Elemento specifico 2"
  ],
  "expectedDepth": "basic|intermediate|advanced",
  "reasoningBehind": "Perché questa domanda è importante ora"
}`;
    }

    parseFollowUpQuestion(aiResponse) {
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
            throw new Error("No JSON found in follow-up response");
        } catch (error) {
            console.error('❌ Failed to parse follow-up question:', error);
            throw new Error(`Follow-up parsing failed: ${error.message}`);
        }
    }

    // Determina se l'esame è pronto per la valutazione finale
    isReadyForFinalEvaluation(conversationHistory, currentAnalysis) {
        const followUpCount = conversationHistory.filter(turn => 
            turn.metadata?.type === 'follow_up_question'
        ).length;
        
        const completeness = currentAnalysis?.overallCompleteness || 0;
        const maxFollowUps = this.examinationConfig.followUpQuestionsMax;
        
        // Pronto se:
        // 1. Abbiamo raggiunto il limite di follow-up
        // 2. La completezza è alta e non ci sono lacune gravi
        // 3. Lo studente ha coperto tutto adeguatamente
        
        return (
            followUpCount >= maxFollowUps || 
            (completeness >= 85 && (currentAnalysis?.missingElements?.length || 0) <= 1) ||
            (completeness >= 95)
        );
    }

    // Prepara i dati per la valutazione finale
    prepareForFinalEvaluation(conversationHistory, pdfData, allAnalyses) {
        const studentTurns = conversationHistory.filter(turn => turn.speaker === 'student');
        const professorTurns = conversationHistory.filter(turn => turn.speaker === 'professor');
        
        // Combina tutte le analisi fatte durante l'esame
        const combinedAnalysis = this.combineAnalyses(allAnalyses);
        
        return {
            pdfData: pdfData,
            conversationHistory: conversationHistory,
            studentTurns: studentTurns,
            professorTurns: professorTurns,
            combinedAnalysis: combinedAnalysis,
            examinationMetadata: {
                totalTurns: conversationHistory.length,
                followUpQuestions: professorTurns.filter(turn => 
                    turn.metadata?.type === 'follow_up_question'
                ).length,
                treatmentPhases: studentTurns.length,
                finalCompleteness: combinedAnalysis.overallCompleteness,
                examinationDuration: this.calculateExaminationDuration(conversationHistory)
            }
        };
    }

    combineAnalyses(analyses) {
        if (!analyses || analyses.length === 0) {
            return this.getDefaultAnalysis();
        }
        
        const latest = analyses[analyses.length - 1];
        const trends = this.calculateTrends(analyses);
        
        return {
            ...latest,
            trends: trends,
            improvementOverTime: trends.improvementOverTime,
            consistencyScore: trends.consistencyScore
        };
    }

    calculateTrends(analyses) {
        if (analyses.length < 2) {
            return { improvementOverTime: 0, consistencyScore: 1.0 };
        }
        
        const scores = analyses.map(a => a.overallCompleteness);
        const improvement = scores[scores.length - 1] - scores[0];
        
        // Calcola consistenza (bassa varianza = alta consistenza)
        const avg = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        const variance = scores.reduce((sum, score) => sum + Math.pow(score - avg, 2), 0) / scores.length;
        const consistencyScore = Math.max(0, 1 - (variance / 100));
        
        return {
            improvementOverTime: improvement,
            consistencyScore: consistencyScore
        };
    }

    calculateExaminationDuration(conversationHistory) {
        if (conversationHistory.length === 0) return 0;
        
        const start = new Date(conversationHistory[0].timestamp);
        const end = new Date(conversationHistory[conversationHistory.length - 1].timestamp);
        
        return Math.round((end - start) / (1000 * 60)); // minuti
    }

    // Metodi di fallback
    getFallbackInitialRequest(personality, pdfData) {
        return {
            message: `Buongiorno. Mi faccia una trattazione completa e sistematica di tutto il contenuto presente nel materiale che ha studiato. Includa tutte le formule, le derivazioni, i grafici e i concetti, spiegando tutto dall'inizio alla fine in modo organizzato.`,
            expectedElements: ["Concetti teorici", "Formule e derivazioni", "Spiegazione di grafici", "Applicazioni pratiche"],
            evaluationCriteria: ["Completezza", "Accuratezza tecnica", "Organizzazione", "Comprensione"],
            estimatedDuration: "15-20 minuti",
            type: 'comprehensive_treatment',
            metadata: {
                pdfAnalysis: pdfData.analysisContext,
                personality: personality.key,
                generatedAt: new Date().toISOString(),
                fallback: true
            }
        };
    }

    getIntelligentInitialRequest(pdfData, personality) {
        const personalityKey = personality.key || 'adaptive';
        const complexity = pdfData.analysisContext?.complexity || 'medium';
        const hasFormulas = pdfData.analysisContext?.hasVisualElements || false;
        const pages = pdfData.analysisContext?.totalPages || 10;
        const contentTypes = pdfData.analysisContext?.contentTypes || ['physics'];
        
        // Messaggio base personalizzato per personalità
        let greeting = "Buongiorno.";
        let requestStyle = "";
        
        switch (personalityKey) {
            case 'strict':
                greeting = "Prego, accomodatevi.";
                requestStyle = " Voglio una trattazione rigorosa e precisa di tutto il materiale, senza omettere dettagli tecnici essenziali.";
                break;
            case 'kind':
                greeting = "Buongiorno! Spero che si senta a suo agio.";
                requestStyle = " Mi farebbe piacere sentire la sua spiegazione completa del materiale che ha studiato.";
                break;
            case 'sarcastic':
                greeting = "Bene, vediamo cosa ha imparato.";
                requestStyle = " Mi dimostri che il tempo dedicato allo studio non è stato completamente sprecato.";
                break;
            case 'patient':
                greeting = "Buongiorno. Prenda pure tutto il tempo che le serve.";
                requestStyle = " Faccia una trattazione completa e metodica, procedendo con calma dall'inizio alla fine.";
                break;
            default: // adaptive
                greeting = "Buongiorno.";
                requestStyle = " Mi faccia una trattazione completa e sistematica di tutto il contenuto presente nel materiale.";
        }
        
        // Elementi attesi basati sui metadati PDF
        const expectedElements = [
            "Concetti teorici fondamentali",
            "Principi fisici coinvolti"
        ];
        
        if (hasFormulas || contentTypes.includes('mathematical')) {
            expectedElements.push("Formule e derivazioni matematiche");
            expectedElements.push("Calcoli e dimostrazioni");
        }
        
        if (hasFormulas) {
            expectedElements.push("Spiegazione di grafici, diagrammi e figure");
        }
        
        if (contentTypes.includes('physics')) {
            expectedElements.push("Applicazioni pratiche dei concetti");
            expectedElements.push("Connessioni tra i diversi argomenti");
        }
        
        if (complexity === 'high' || complexity === 'very_high') {
            expectedElements.push("Approfondimenti teorici avanzati");
        }
        
        // Durata stimata basata su complessità e pagine
        let estimatedDuration = "15-20 minuti";
        if (pages > 15 || complexity === 'high') {
            estimatedDuration = "20-25 minuti";
        } else if (pages > 25 || complexity === 'very_high') {
            estimatedDuration = "25-30 minuti";
        } else if (pages < 10 && complexity === 'low') {
            estimatedDuration = "10-15 minuti";
        }
        
        // Criteri di valutazione personalizzati
        const evaluationCriteria = [
            "Completezza della trattazione",
            "Accuratezza tecnica e scientifica",
            "Organizzazione logica dell'esposizione",
            "Comprensione concettuale dimostrata"
        ];
        
        if (hasFormulas) {
            evaluationCriteria.push("Correttezza delle derivazioni matematiche");
        }
        
        if (complexity === 'high' || complexity === 'very_high') {
            evaluationCriteria.push("Padronanza degli aspetti avanzati");
        }
        
        // Costruzione del messaggio finale
        const coreRequest = `${requestStyle} Includa tutti i concetti, le formule, le derivazioni e le spiegazioni presenti nel materiale, procedendo dall'inizio alla fine in modo organizzato e dettagliato.`;
        
        let additionalInstructions = "";
        if (hasFormulas) {
            additionalInstructions += " Non dimentichi di spiegare tutti i grafici, diagrammi e figure presenti.";
        }
        if (complexity === 'high') {
            additionalInstructions += " Mi aspetto un livello di approfondimento coerente con la complessità del materiale.";
        }
        
        const fullMessage = `${greeting}${coreRequest}${additionalInstructions}`;
        
        return {
            message: fullMessage,
            expectedElements: expectedElements,
            evaluationCriteria: evaluationCriteria,
            estimatedDuration: estimatedDuration,
            type: 'comprehensive_treatment',
            metadata: {
                pdfAnalysis: pdfData.analysisContext,
                personality: personality.key,
                generatedAt: new Date().toISOString(),
                intelligentFallback: true,
                basedOnComplexity: complexity,
                basedOnPages: pages,
                basedOnContentTypes: contentTypes
            }
        };
    }

    getFallbackTreatmentAnalysis() {
        return {
            analysis: this.getDefaultAnalysis(),
            nextAction: {
                type: 'final_evaluation',
                reason: 'Analysis failed, proceeding to evaluation',
                urgency: 'low'
            },
            treatmentQuality: 60,
            readyForEvaluation: true
        };
    }

    getQuickFallbackAnalysis(studentTreatment, conversationHistory) {
        const wordCount = studentTreatment.trim().split(' ').length;
        const followUpCount = conversationHistory.filter(turn => 
            turn.metadata?.type === 'follow_up_question'
        ).length;
        
        // Analisi rapida per risposte molto brevi
        const baseScore = Math.max(20, Math.min(40, wordCount * 5));
        
        return {
            analysis: {
                overallCompleteness: baseScore,
                contentCoverage: baseScore,
                technicalAccuracy: Math.max(20, baseScore - 10),
                organizationFlow: Math.max(25, baseScore - 5),
                conceptualDepth: Math.max(15, baseScore - 15),
                missingElements: ["Contenuto sostanziale", "Dettagli tecnici", "Spiegazione completa"],
                technicalErrors: [],
                strengths: wordCount > 1 ? ["Tentativo di risposta"] : [],
                improvementAreas: ["Necessaria risposta più dettagliata"],
                readyForAdvanced: false,
                recommendedFollowUp: 'missing_concepts',
                estimatedComprehension: 'poor'
            },
            nextAction: {
                type: followUpCount >= 2 ? 'final_evaluation' : 'request_completion',
                reason: wordCount < 5 ? 'Response too short' : 'Needs more detail',
                urgency: 'high'
            },
            treatmentQuality: baseScore,
            readyForEvaluation: followUpCount >= 2
        };
    }

    getComprehensiveFallbackAnalysis(studentTreatment, conversationHistory) {
        const wordCount = studentTreatment.trim().split(' ').length;
        const followUpCount = conversationHistory.filter(turn => 
            turn.metadata?.type === 'follow_up_question'
        ).length;
        
        // Analisi locale più sofisticata
        let baseScore = 45; // Inizia più basso per essere realistici
        
        // Valutazione lunghezza
        if (wordCount >= 50) baseScore += 10;
        if (wordCount >= 100) baseScore += 10;
        if (wordCount >= 200) baseScore += 5;
        if (wordCount >= 300) baseScore += 5;
        
        // Valutazione contenuto tecnico
        const physicsTerms = ['energia', 'forza', 'velocità', 'accelerazione', 'massa', 'pressione', 'temperatura', 'campo', 'onda', 'frequenza', 'formula', 'legge', 'principio', 'teorema', 'equazione'];
        const physicsTermsFound = physicsTerms.filter(term => 
            studentTreatment.toLowerCase().includes(term)
        ).length;
        
        if (physicsTermsFound >= 2) baseScore += 10;
        if (physicsTermsFound >= 4) baseScore += 5;
        if (physicsTermsFound >= 6) baseScore += 5;
        
        // Valutazione formule/numeri
        const hasNumbers = /\d/.test(studentTreatment);
        const hasFormulas = /[=+\-*/^²³]/.test(studentTreatment);
        const hasEquations = /[a-zA-Z]\s*[=]\s*[a-zA-Z0-9+\-*/^²³\s()]+/.test(studentTreatment);
        
        if (hasNumbers) baseScore += 3;
        if (hasFormulas) baseScore += 5;
        if (hasEquations) baseScore += 7;
        
        // Limita il punteggio massimo per fallback
        const finalScore = Math.min(75, Math.max(20, baseScore));
        
        // Decide azione successiva
        let nextActionType = 'final_evaluation';
        if (finalScore < 50 && followUpCount < 2) {
            nextActionType = 'request_completion';
        } else if (finalScore < 65 && followUpCount < 1) {
            nextActionType = 'general_follow_up';
        }
        
        return {
            analysis: {
                overallCompleteness: finalScore,
                contentCoverage: Math.max(30, finalScore - 5),
                technicalAccuracy: Math.max(25, finalScore - 10),
                organizationFlow: Math.max(35, finalScore - 8),
                conceptualDepth: Math.max(25, finalScore - 15),
                missingElements: finalScore < 60 ? ["Maggiori dettagli tecnici", "Formule specifiche", "Applicazioni pratiche"] : finalScore < 70 ? ["Alcuni approfondimenti"] : [],
                technicalErrors: [],
                strengths: [
                    ...(wordCount >= 100 ? ["Esposizione articolata"] : []),
                    ...(physicsTermsFound >= 3 ? ["Uso terminologia fisica"] : []),
                    ...(hasFormulas ? ["Inclusione di formule"] : []),
                    ...(wordCount >= 50 ? ["Partecipazione attiva"] : ["Tentativo di risposta"])
                ],
                improvementAreas: [
                    ...(finalScore < 60 ? ["Maggiore completezza richiesta"] : []),
                    ...(physicsTermsFound < 3 ? ["Più terminologia tecnica"] : []),
                    ...(wordCount < 100 ? ["Esposizione più dettagliata"] : []),
                    "Fallback automatico utilizzato"
                ],
                readyForAdvanced: finalScore >= 70,
                recommendedFollowUp: finalScore < 50 ? 'missing_concepts' : 'conceptual_depth',
                estimatedComprehension: finalScore >= 65 ? 'good' : finalScore >= 50 ? 'basic' : 'poor'
            },
            nextAction: {
                type: nextActionType,
                reason: `Local analysis: score ${finalScore}, follow-ups: ${followUpCount}`,
                urgency: finalScore < 50 ? 'high' : 'medium'
            },
            treatmentQuality: finalScore,
            readyForEvaluation: nextActionType === 'final_evaluation'
        };
    }

    getFallbackFollowUpQuestion(nextAction, personality) {
        return {
            message: "Può approfondire meglio gli aspetti che ha trattato più superficialmente?",
            type: 'follow_up_question',
            followUpType: 'general',
            targetedElements: ["Approfondimento generale"],
            expectedDepth: "intermediate",
            metadata: {
                fallback: true,
                actionType: nextAction.type,
                generatedAt: new Date().toISOString()
            }
        };
    }

    getIntelligentFollowUpQuestion(nextAction, personality, analysis) {
        const personalityKey = personality.key || 'adaptive';
        const missingElements = analysis.missingElements || [];
        const completeness = analysis.overallCompleteness || 50;
        
        // Scelta intelligente della domanda basata su:
        // 1. Personalità del professore
        // 2. Elementi mancanti nell'analisi
        // 3. Livello di completezza
        
        let questionTemplates = [];
        
        // Domande basate sulla personalità
        if (personalityKey === 'strict') {
            questionTemplates = [
                "Può essere più preciso nell'esposizione dei concetti fondamentali?",
                "La sua trattazione necessita di maggiore rigore scientifico. Può elaborare?",
                "Specifichi meglio le derivazioni matematiche e i principi fisici coinvolti.",
                "Dove sono i dettagli tecnici essenziali della sua esposizione?"
            ];
        } else if (personalityKey === 'kind') {
            questionTemplates = [
                "Può aiutarmi a capire meglio alcuni aspetti che ha accennato?",
                "Sarebbe interessante se potesse approfondire ulteriormente alcuni punti.",
                "Può spiegarmi con più dettagli i concetti che trova più significativi?",
                "Mi piacerebbe sentire la sua spiegazione più completa di questi argomenti."
            ];
        } else if (personalityKey === 'sarcastic') {
            questionTemplates = [
                "Interessante... e il resto dove lo ha lasciato?",
                "Presumo che ci sia dell'altro, o questa è la versione completa?",
                "Sta testando la mia pazienza o c'è una continuazione?",
                "Bene, ora che ha rotto il ghiaccio, può dirmi il resto?"
            ];
        } else if (personalityKey === 'patient') {
            questionTemplates = [
                "Prendiamo tempo per approfondire meglio alcuni aspetti. Può continuare?",
                "Non c'è fretta. Può elaborare con calma i punti che ritiene più importanti?",
                "Procedendo con ordine, può spiegarmi meglio questi concetti?",
                "Con calma e sistematicità, può completare la sua esposizione?"
            ];
        } else { // adaptive
            questionTemplates = [
                "Può approfondire gli aspetti tecnici più rilevanti?",
                "Quali sono le connessioni principali tra i concetti che ha esposto?",
                "Può elaborare le parti che necessitano di maggiore dettaglio?",
                "Come collegerebbe questi concetti alle loro applicazioni pratiche?"
            ];
        }
        
        // Domande basate sugli elementi mancanti
        if (missingElements.includes('Formule e derivazioni')) {
            questionTemplates.push("Può mostrarmi le derivazioni matematiche principali?");
            questionTemplates.push("Quali sono le formule fondamentali coinvolte?");
        }
        
        if (missingElements.includes('Applicazioni pratiche')) {
            questionTemplates.push("Può illustrare le applicazioni pratiche di questi concetti?");
            questionTemplates.push("Come si applicano questi principi nella realtà?");
        }
        
        if (missingElements.includes('Principi fisici')) {
            questionTemplates.push("Quali sono i principi fisici fondamentali coinvolti?");
            questionTemplates.push("Può spiegare i meccanismi fisici sottostanti?");
        }
        
        // Domande basate sul livello di completezza
        if (completeness < 40) {
            questionTemplates.push("La sua esposizione necessita di essere sostanzialmente ampliata. Può continuare?");
            questionTemplates.push("Può fornire una spiegazione molto più dettagliata e completa?");
        } else if (completeness < 60) {
            questionTemplates.push("Può completare la sua trattazione con maggiori dettagli?");
            questionTemplates.push("Alcuni aspetti meritano ulteriore approfondimento. Può continuare?");
        } else {
            questionTemplates.push("Può perfezionare alcuni aspetti della sua esposizione?");
            questionTemplates.push("Ci sono punti che può chiarire ulteriormente?");
        }
        
        // Selezione casuale ma pesata
        const selectedQuestion = questionTemplates[Math.floor(Math.random() * questionTemplates.length)];
        
        // Elementi target basati sull'analisi
        const targetElements = missingElements.length > 0 ? 
            missingElements.slice(0, 2) : 
            ["Approfondimenti tecnici", "Dettagli specifici"];
        
        // Profondità attesa basata sulla completezza
        const expectedDepth = completeness >= 60 ? 'advanced' : 
                             completeness >= 40 ? 'intermediate' : 'basic';
        
        return {
            message: selectedQuestion,
            type: 'follow_up_question',
            followUpType: nextAction.followUpType || 'general',
            targetedElements: targetElements,
            expectedDepth: expectedDepth,
            metadata: {
                intelligentFallback: true,
                basedOnPersonality: personalityKey,
                basedOnCompleteness: completeness,
                basedOnMissingElements: missingElements,
                actionType: nextAction.type,
                generatedAt: new Date().toISOString()
            }
        };
    }

    getDefaultAnalysis() {
        return {
            overallCompleteness: 60,
            contentCoverage: 60,
            technicalAccuracy: 65,
            organizationFlow: 60,
            conceptualDepth: 55,
            missingElements: ["Alcuni elementi non identificabili"],
            technicalErrors: [],
            strengths: ["Partecipazione"],
            improvementAreas: ["Maggiore completezza"],
            readyForAdvanced: false,
            recommendedFollowUp: 'conceptual_depth',
            estimatedComprehension: 'basic'
        };
    }

    // Metodo di utilità per debugging
    async debugCoordination(pdfData, studentInput, options = {}) {
        console.log('🐛 Debug: Coordination process starting...');
        
        const personality = options.personality || { key: 'adaptive', name: 'Adattivo' };
        
        // Test initial request
        console.log('🐛 Testing initial request generation...');
        const initialRequest = await this.generateInitialTreatmentRequest(pdfData, personality);
        
        // Test treatment analysis if student input provided
        if (studentInput) {
            console.log('🐛 Testing treatment analysis...');
            const analysis = await this.analyzeTreatmentAndDecideNext(
                studentInput, 
                pdfData, 
                initialRequest, 
                []
            );
            
            console.log('🐛 Analysis result:', {
                completeness: analysis.analysis?.overallCompleteness,
                nextAction: analysis.nextAction?.type,
                readyForEval: analysis.readyForEvaluation
            });
            
            return {
                initialRequest,
                analysis,
                debugInfo: {
                    pdfAnalysis: pdfData.analysisContext,
                    personality: personality
                }
            };
        }
        
        return {
            initialRequest,
            debugInfo: {
                pdfAnalysis: pdfData.analysisContext,
                personality: personality
            }
        };
    }
}

export default ExaminationCoordinator;