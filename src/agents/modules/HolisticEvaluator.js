// ==========================================
// FILE: src/agents/modules/HolisticEvaluator.js (VALUTAZIONE OLISTICA COMPLETA)
// ==========================================

import { GoogleGenerativeAI } from '@google/generative-ai';

export class HolisticEvaluator {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        this.agentProfile = null;
        this.currentSessionId = null;
        
        // Pesi per la valutazione olistica
        this.evaluationWeights = {
            contentMastery: 0.30,        // Padronanza del contenuto
            technicalAccuracy: 0.25,     // Accuratezza tecnica
            completeness: 0.20,          // Completezza della trattazione
            organizationClarity: 0.15,   // Organizzazione e chiarezza
            conceptualDepth: 0.10        // Profondità concettuale
        };

        // Criteri di valutazione olistica più rigorosi
        this.holisticCriteria = {
            contentMastery: {
                excellent: "Padronanza completa di tutti i concetti, formule derivate correttamente",
                good: "Buona padronanza con minori imprecisioni",
                basic: "Comprensione di base ma con lacune significative",
                poor: "Comprensione limitata o errata dei concetti fondamentali"
            },
            technicalAccuracy: {
                excellent: "Tutte le formule e calcoli corretti, terminologia precisa",
                good: "Principalmente corretto con errori minori",
                basic: "Alcuni errori tecnici ma comprensione di base presente",
                poor: "Errori significativi che compromettono la comprensione"
            },
            completeness: {
                excellent: "Copertura completa di tutti gli argomenti del materiale",
                good: "Copertura quasi completa con omissioni minori",
                basic: "Copertura parziale degli argomenti principali",
                poor: "Copertura insufficiente o molto lacunosa"
            }
        };

        // Soglie severe per i punteggi
        this.severityThresholds = {
            minimumWords: 100,           // Minimo per evitare fallimento automatico
            excellenceThreshold: 90,     // Per voti di eccellenza
            goodThreshold: 75,           // Per voti buoni
            sufficiencyThreshold: 55     // Per sufficienza
        };
    }

    async initialize(agentProfile) {
        this.agentProfile = agentProfile;
        console.log('📊 Holistic Evaluator initialized');
    }

    // Valutazione olistica completa dell'esame
    async generateHolisticEvaluation(evaluationData) {
        try {
            console.log('📊 Starting holistic evaluation...');
            
            const { pdfData, conversationHistory, combinedAnalysis } = evaluationData;
            
            // Prima valutazione: confronto diretto con il PDF
            const contentComparison = await this.compareWithOriginalContent(
                pdfData, 
                conversationHistory, 
                combinedAnalysis
            );
            
            // Seconda valutazione: analisi qualitativa dell'esposizione
            const expositionQuality = await this.evaluateExpositionQuality(
                conversationHistory,
                evaluationData.examinationMetadata
            );
            
            // Terza valutazione: valutazione finale integrata
            const finalEvaluation = await this.generateIntegratedFinalEvaluation(
                pdfData,
                conversationHistory,
                contentComparison,
                expositionQuality,
                combinedAnalysis
            );
            
            // Applica post-processing severo
            const severeFinalEvaluation = this.applySeverePostProcessing(
                finalEvaluation,
                conversationHistory,
                evaluationData.examinationMetadata
            );
            
            console.log(`✅ Holistic evaluation completed: ${severeFinalEvaluation.gradeRecommendation}`);
            
            return severeFinalEvaluation;
            
        } catch (error) {
            console.error('❌ Holistic evaluation failed:', error);
            return this.getSevereFallbackEvaluation(evaluationData);
        }
    }

    // Confronta la trattazione dello studente con il contenuto originale del PDF
    async compareWithOriginalContent(pdfData, conversationHistory, combinedAnalysis) {
        try {
            console.log('🔍 Comparing student treatment with original PDF content...');
            
            const studentContent = this.extractStudentContent(conversationHistory);
            const prompt = this.buildContentComparisonPrompt(studentContent, combinedAnalysis);
            
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
            
            const comparison = this.parseContentComparison(aiResponse);
            
            console.log('✅ Content comparison completed');
            return comparison;
            
        } catch (error) {
            console.error('❌ Content comparison failed:', error);
            return this.getFallbackContentComparison();
        }
    }

    buildContentComparisonPrompt(studentContent, combinedAnalysis) {
        return `Sei un professore universitario di fisica che deve fare una valutazione RIGOROSA e SEVERA.

HAI IL PDF ORIGINALE che lo studente doveva studiare completamente.

TRATTAZIONE COMPLETA DELLO STUDENTE:
"${studentContent}"

ANALISI PRECEDENTI:
- Completezza generale: ${combinedAnalysis.overallCompleteness}%
- Accuratezza tecnica: ${combinedAnalysis.technicalAccuracy}%
- Elementi mancanti: ${JSON.stringify(combinedAnalysis.missingElements)}

COMPITO RIGOROSO:
Confronta DETTAGLIATAMENTE la trattazione dello studente con il contenuto COMPLETO del PDF.

VALUTAZIONE RICHIESTA:
1. COPERTURA CONTENUTISTICA (0-100%):
   Che percentuale del PDF è stata effettivamente coperta?
   
2. ACCURATEZZA DELLE FORMULE (0-100%):
   Le formule presenti nel PDF sono state riportate/derivate correttamente?
   
3. SPIEGAZIONE GRAFICI/DIAGRAMMI (0-100%):
   Gli elementi visivi del PDF sono stati spiegati adeguatamente?
   
4. CONNESSIONI CONCETTUALI (0-100%):
   Lo studente ha collegato i concetti come nel PDF originale?

SEVERITÀ: Sii RIGOROSO. Se elementi importanti mancano, penalizza duramente.

Rispondi SOLO in formato JSON:

{
  "contentCoverage": 75,
  "formulaAccuracy": 80,
  "visualElementsExplanation": 60,
  "conceptualConnections": 70,
  "overallFidelity": 72,
  "criticalOmissions": [
    "Sezione importante non trattata 1",
    "Formula chiave non derivata 2"
  ],
  "significantErrors": [
    {
      "type": "formula_error|concept_error|omission",
      "description": "Descrizione errore specifico",
      "severity": "critical|high|medium|low",
      "impactOnUnderstanding": "Impatto sulla comprensione"
    }
  ],
  "fidelityToOriginal": "excellent|good|fair|poor",
  "recommendedPenalties": [
    "Penalità 1 per omissione critica",
    "Penalità 2 per errore significativo"
  ]
}`;
    }

    extractStudentContent(conversationHistory) {
        const studentTurns = conversationHistory
            .filter(turn => turn.speaker === 'student')
            .map(turn => turn.content)
            .join('\n\n--- CONTINUA ---\n\n');
        
        return studentTurns;
    }

    parseContentComparison(aiResponse) {
        try {
            const cleanedText = aiResponse
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();
                
            const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const jsonString = jsonMatch[0].replace(/,\s*(\]|})/g, '$1');
                const parsed = JSON.parse(jsonString);
                return this.normalizeContentComparison(parsed);
            }
            throw new Error("No JSON found in content comparison");
        } catch (error) {
            console.error('❌ Failed to parse content comparison:', error);
            throw new Error(`Content comparison parsing failed: ${error.message}`);
        }
    }

    normalizeContentComparison(comparison) {
        const scoreFields = ['contentCoverage', 'formulaAccuracy', 'visualElementsExplanation', 'conceptualConnections', 'overallFidelity'];
        
        scoreFields.forEach(field => {
            if (typeof comparison[field] === 'number') {
                comparison[field] = Math.max(0, Math.min(100, comparison[field]));
            } else {
                comparison[field] = 50; // Default conservativo
            }
        });
        
        comparison.criticalOmissions = comparison.criticalOmissions || [];
        comparison.significantErrors = comparison.significantErrors || [];
        comparison.recommendedPenalties = comparison.recommendedPenalties || [];
        
        return comparison;
    }

    // Valuta la qualità dell'esposizione indipendentemente dal contenuto
    async evaluateExpositionQuality(conversationHistory, examinationMetadata) {
        try {
            console.log('🎤 Evaluating exposition quality...');
            
            const prompt = this.buildExpositionQualityPrompt(conversationHistory, examinationMetadata);
            
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const aiResponse = response.text();
            
            const qualityEvaluation = this.parseExpositionQuality(aiResponse);
            
            console.log('✅ Exposition quality evaluated');
            return qualityEvaluation;
            
        } catch (error) {
            console.error('❌ Exposition quality evaluation failed:', error);
            return this.getFallbackExpositionQuality(conversationHistory);
        }
    }

    buildExpositionQualityPrompt(conversationHistory, metadata) {
        const studentTurns = conversationHistory.filter(turn => turn.speaker === 'student');
        const totalWords = studentTurns.reduce((total, turn) => 
            total + turn.content.split(' ').length, 0
        );
        const avgResponseLength = totalWords / studentTurns.length;

        return `Sei un professore universitario che valuta la QUALITÀ DELL'ESPOSIZIONE orale.

DATI DELL'ESAME:
- Turni di conversazione totali: ${metadata.totalTurns}
- Risposte dello studente: ${studentTurns.length}
- Parole totali studente: ${totalWords}
- Lunghezza media risposta: ${Math.round(avgResponseLength)} parole
- Durata esame: ${metadata.examinationDuration} minuti

CONVERSAZIONE COMPLETA:
${conversationHistory.map(turn => 
    `${turn.speaker?.toUpperCase()}: ${turn.content}`
).join('\n\n')}

VALUTA LA QUALITÀ ESPOSITIVA:

1. ORGANIZZAZIONE (0-100):
   L'esposizione è strutturata logicamente? Sequenza coerente?

2. CHIAREZZA COMUNICATIVA (0-100):
   Lo studente si esprime chiaramente? Linguaggio appropriato?

3. COMPLETEZZA DELLE RISPOSTE (0-100):
   Le risposte sono complete o troppo brevi/evasive?

4. FLUSSO LOGICO (0-100):
   C'è coerenza nel passaggio tra i concetti?

5. LINGUAGGIO TECNICO (0-100):
   Uso appropriato della terminologia scientifica?

CRITERI SEVERI:
- Risposte sotto 50 parole: penalità
- Esposizione disorganizzata: penalità
- Linguaggio inappropriato: penalità

Rispondi SOLO in formato JSON:

{
  "organizationScore": 75,
  "clarityScore": 80,
  "responsivenessScore": 70,
  "logicalFlowScore": 75,
  "technicalLanguageScore": 65,
  "overallExpositionQuality": 73,
  "strengths": [
    "Forza espositiva 1",
    "Forza espositiva 2"
  ],
  "weaknesses": [
    "Debolezza espositiva 1",
    "Debolezza espositiva 2"
  ],
  "communicationStyle": "excellent|good|adequate|poor",
  "recommendedImprovements": [
    "Miglioramento 1",
    "Miglioramento 2"
  ]
}`;
    }

    parseExpositionQuality(aiResponse) {
        try {
            const cleanedText = aiResponse
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();
                
            const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const jsonString = jsonMatch[0].replace(/,\s*(\]|})/g, '$1');
                const parsed = JSON.parse(jsonString);
                return this.normalizeExpositionQuality(parsed);
            }
            throw new Error("No JSON found in exposition quality response");
        } catch (error) {
            console.error('❌ Failed to parse exposition quality:', error);
            throw new Error(`Exposition quality parsing failed: ${error.message}`);
        }
    }

    normalizeExpositionQuality(quality) {
        const scoreFields = ['organizationScore', 'clarityScore', 'responsivenessScore', 'logicalFlowScore', 'technicalLanguageScore', 'overallExpositionQuality'];
        
        scoreFields.forEach(field => {
            if (typeof quality[field] === 'number') {
                quality[field] = Math.max(0, Math.min(100, quality[field]));
            } else {
                quality[field] = 50;
            }
        });
        
        quality.strengths = quality.strengths || [];
        quality.weaknesses = quality.weaknesses || [];
        quality.recommendedImprovements = quality.recommendedImprovements || [];
        
        return quality;
    }

    // Genera la valutazione finale integrata
    async generateIntegratedFinalEvaluation(pdfData, conversationHistory, contentComparison, expositionQuality, combinedAnalysis) {
        try {
            console.log('🏁 Generating integrated final evaluation...');
            
            const prompt = this.buildIntegratedEvaluationPrompt(
                contentComparison, 
                expositionQuality, 
                combinedAnalysis,
                conversationHistory
            );
            
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
            
            const finalEvaluation = this.parseIntegratedEvaluation(aiResponse);
            
            // Aggiungi metadati
            finalEvaluation.evaluationComponents = {
                contentComparison: contentComparison,
                expositionQuality: expositionQuality,
                combinedAnalysis: combinedAnalysis
            };
            
            finalEvaluation.evaluationTimestamp = new Date().toISOString();
            
            console.log('✅ Integrated final evaluation completed');
            return finalEvaluation;
            
        } catch (error) {
            console.error('❌ Integrated final evaluation failed:', error);
            return this.getFallbackFinalEvaluation(contentComparison, expositionQuality);
        }
    }

    buildIntegratedEvaluationPrompt(contentComparison, expositionQuality, combinedAnalysis, conversationHistory) {
        const studentTurnCount = conversationHistory.filter(turn => turn.speaker === 'student').length;
        
        return `Sei un professore universitario che deve dare la VALUTAZIONE FINALE RIGOROSA di un esame orale.

HAI A DISPOSIZIONE:

1. CONFRONTO CON CONTENUTO ORIGINALE:
   - Copertura contenuti: ${contentComparison.contentCoverage}%
   - Accuratezza formule: ${contentComparison.formulaAccuracy}%
   - Spiegazione elementi visivi: ${contentComparison.visualElementsExplanation}%
   - Fedeltà all'originale: ${contentComparison.fidelityToOriginal}
   - Omissioni critiche: ${JSON.stringify(contentComparison.criticalOmissions)}

2. QUALITÀ ESPOSIZIONE:
   - Organizzazione: ${expositionQuality.organizationScore}%
   - Chiarezza: ${expositionQuality.clarityScore}%
   - Completezza risposte: ${expositionQuality.responsivenessScore}%
   - Linguaggio tecnico: ${expositionQuality.technicalLanguageScore}%

3. ANALISI PROGRESSIVE:
   - Completezza finale: ${combinedAnalysis.overallCompleteness}%
   - Accuratezza tecnica: ${combinedAnalysis.technicalAccuracy}%
   - Comprensione stimata: ${combinedAnalysis.estimatedComprehension}

4. DATI QUANTITATIVI:
   - Numero risposte studente: ${studentTurnCount}
   - Elementi mancanti: ${combinedAnalysis.missingElements?.length || 0}

COMPITO FINALE:
Genera una valutazione RIGOROSA che integri tutti questi aspetti.

SCALE DI VALUTAZIONE SEVERE:
- 30/30: Solo per prestazioni ECCELLENTI (95%+)
- 27-29/30: Prestazioni OTTIME (85-94%)
- 24-26/30: Prestazioni BUONE (75-84%)
- 21-23/30: Prestazioni SUFFICIENTI (60-74%)
- 18-20/30: Prestazioni APPENA SUFFICIENTI (55-59%)
- Insufficiente: <55%

REGOLE SEVERE:
1. Omissioni critiche: -5 punti sul voto
2. Errori significativi: -3 punti sul voto
3. Esposizione carente: -2 punti sul voto
4. Risposte troppo brevi: -2 punti sul voto

Rispondi SOLO in formato JSON:

{
  "overallScore": 78,
  "gradeRecommendation": "24/30",
  "gradeDescription": "Buono",
  "componentScores": {
    "contentMastery": 75,
    "technicalAccuracy": 80,
    "completeness": 70,
    "organizationClarity": 75,
    "conceptualDepth": 70
  },
  "strengths": [
    "Forza principale 1",
    "Forza principale 2"
  ],
  "criticalWeaknesses": [
    "Debolezza critica 1",
    "Debolezza critica 2"
  ],
  "studyRecommendations": [
    "Raccomandazione specifica 1",
    "Raccomandazione specifica 2"
  ],
  "feedback": {
    "positive": "Feedback positivo dettagliato",
    "constructive": "Critica costruttiva specifica",
    "encouragement": "Incoraggiamento personalizzato"
  },
  "penaltiesApplied": [
    "Penalità applicata 1",
    "Penalità applicata 2"
  ],
  "sessionQuality": "excellent|good|adequate|poor"
}`;
    }

    parseIntegratedEvaluation(aiResponse) {
        try {
            const cleanedText = aiResponse
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();
                
            const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const jsonString = jsonMatch[0].replace(/,\s*(\]|})/g, '$1');
                const parsed = JSON.parse(jsonString);
                return this.normalizeIntegratedEvaluation(parsed);
            }
            throw new Error("No JSON found in integrated evaluation");
        } catch (error) {
            console.error('❌ Failed to parse integrated evaluation:', error);
            throw new Error(`Integrated evaluation parsing failed: ${error.message}`);
        }
    }

    normalizeIntegratedEvaluation(evaluation) {
        // Normalizza il punteggio principale
        evaluation.overallScore = Math.max(0, Math.min(100, evaluation.overallScore || 60));
        
        // Normalizza i punteggi dei componenti
        if (evaluation.componentScores) {
            Object.keys(evaluation.componentScores).forEach(component => {
                evaluation.componentScores[component] = Math.max(0, Math.min(100, evaluation.componentScores[component] || 50));
            });
        }
        
        // Assicura che ci siano array appropriati
        evaluation.strengths = evaluation.strengths || [];
        evaluation.criticalWeaknesses = evaluation.criticalWeaknesses || [];
        evaluation.studyRecommendations = evaluation.studyRecommendations || [];
        evaluation.penaltiesApplied = evaluation.penaltiesApplied || [];
        
        // Assicura coerenza voto-punteggio
        evaluation.gradeRecommendation = this.validateGradeConsistency(
            evaluation.gradeRecommendation, 
            evaluation.overallScore
        );
        
        evaluation.gradeDescription = this.getGradeDescription(evaluation.overallScore);
        
        return evaluation;
    }

    // Applica post-processing severo finale
    applySeverePostProcessing(evaluation, conversationHistory, metadata) {
        const processed = { ...evaluation };
        
        const studentTurns = conversationHistory.filter(turn => turn.speaker === 'student');
        const totalWords = studentTurns.reduce((total, turn) => 
            total + turn.content.split(' ').length, 0
        );
        const avgResponseLength = totalWords / studentTurns.length;
        
        // PENALITÀ SEVERE aggiuntive
        
        // Penalità per esame troppo breve
        if (totalWords < this.severityThresholds.minimumWords) {
            processed.overallScore = Math.min(processed.overallScore, 30);
            processed.penaltiesApplied.push('Esame troppo breve (< 100 parole totali)');
        }
        
        // Penalità per risposte molto brevi in media
        if (avgResponseLength < 20) {
            processed.overallScore = Math.min(processed.overallScore, 50);
            processed.penaltiesApplied.push('Risposte mediamente troppo brevi');
        }
        
        // Penalità per poche interazioni
        if (studentTurns.length < 2) {
            processed.overallScore = Math.min(processed.overallScore, 40);
            processed.penaltiesApplied.push('Partecipazione insufficiente');
        }
        
        // Penalità per omissioni critiche
        const criticalOmissionsCount = evaluation.evaluationComponents?.contentComparison?.criticalOmissions?.length || 0;
        if (criticalOmissionsCount > 2) {
            processed.overallScore = Math.max(processed.overallScore - (criticalOmissionsCount * 5), 35);
            processed.penaltiesApplied.push(`Omissioni critiche multiple (${criticalOmissionsCount})`);
        }
        
        // Ricalcola il voto finale
        processed.gradeRecommendation = this.scoreToGrade(processed.overallScore);
        processed.gradeDescription = this.getGradeDescription(processed.overallScore);
        
        // Aggiungi metadati finali
        processed.finalProcessing = {
            totalStudentWords: totalWords,
            avgResponseLength: Math.round(avgResponseLength),
            penaltiesCount: processed.penaltiesApplied.length,
            severityLevel: this.determineSeverityLevel(processed.overallScore)
        };
        
        return processed;
    }

    validateGradeConsistency(grade, score) {
        const gradeMatch = grade?.toString().match(/(\d+)/);
        const numericGrade = gradeMatch ? parseInt(gradeMatch[1]) : null;
        
        const expectedGrade = this.scoreToGrade(score);
        
        if (numericGrade && numericGrade >= 18 && numericGrade <= 30) {
            const expectedNumeric = parseInt(expectedGrade.replace('/30', ''));
            if (Math.abs(numericGrade - expectedNumeric) <= 1) {
                return `${numericGrade}/30`;
            }
        }
        
        return expectedGrade;
    }

    scoreToGrade(score) {
        if (score >= 95) return "30/30";
        if (score >= 92) return "29/30";
        if (score >= 89) return "28/30";
        if (score >= 85) return "27/30";
        if (score >= 82) return "26/30";
        if (score >= 79) return "25/30";
        if (score >= 75) return "24/30";
        if (score >= 72) return "23/30";
        if (score >= 68) return "22/30";
        if (score >= 64) return "21/30";
        if (score >= 60) return "20/30";
        if (score >= 57) return "19/30";
        if (score >= 55) return "18/30";
        return "Insufficiente";
    }

    getGradeDescription(score) {
        if (score >= 95) return "Eccellente";
        if (score >= 85) return "Ottimo";
        if (score >= 75) return "Buono";
        if (score >= 60) return "Sufficiente";
        if (score >= 55) return "Appena sufficiente";
        return "Insufficiente";
    }

    determineSeverityLevel(score) {
        if (score >= 85) return "lenient";
        if (score >= 70) return "moderate";
        if (score >= 55) return "strict";
        return "very_strict";
    }

    // Metodi di fallback
    getFallbackContentComparison() {
        return {
            contentCoverage: 50,
            formulaAccuracy: 55,
            visualElementsExplanation: 45,
            conceptualConnections: 50,
            overallFidelity: 50,
            criticalOmissions: ["Analisi non disponibile"],
            significantErrors: [],
            fidelityToOriginal: "fair",
            recommendedPenalties: []
        };
    }

    getFallbackExpositionQuality(conversationHistory) {
        const studentTurns = conversationHistory.filter(turn => turn.speaker === 'student');
        const participationScore = Math.min(70, 30 + (studentTurns.length * 10));
        
        return {
            organizationScore: participationScore,
            clarityScore: Math.max(40, participationScore - 10),
            responsivenessScore: Math.max(35, participationScore - 15),
            logicalFlowScore: Math.max(45, participationScore - 5),
            technicalLanguageScore: Math.max(40, participationScore - 10),
            overallExpositionQuality: participationScore,
            strengths: ["Partecipazione"],
            weaknesses: ["Valutazione automatica"],
            communicationStyle: "adequate",
            recommendedImprovements: ["Maggiore dettaglio nelle risposte"]
        };
    }

    getFallbackFinalEvaluation(contentComparison, expositionQuality) {
        const avgScore = Math.round((
            (contentComparison?.overallFidelity || 50) + 
            (expositionQuality?.overallExpositionQuality || 50)
        ) / 2);
        
        return {
            overallScore: avgScore,
            gradeRecommendation: this.scoreToGrade(avgScore),
            gradeDescription: this.getGradeDescription(avgScore),
            componentScores: {
                contentMastery: avgScore,
                technicalAccuracy: Math.max(40, avgScore - 5),
                completeness: Math.max(35, avgScore - 10),
                organizationClarity: Math.max(45, avgScore),
                conceptualDepth: Math.max(40, avgScore - 8)
            },
            strengths: ["Partecipazione all'esame"],
            criticalWeaknesses: ["Valutazione automatica - dati limitati"],
            studyRecommendations: ["Approfondire la preparazione"],
            feedback: {
                positive: "Ha partecipato all'esame",
                constructive: "Necessaria preparazione più approfondita",
                encouragement: "Con studio costante può migliorare"
            },
            penaltiesApplied: [],
            sessionQuality: avgScore >= 70 ? "adequate" : "poor"
        };
    }

    getSevereFallbackEvaluation(evaluationData) {
        console.log('🔄 Using severe fallback evaluation');
        
        const conversationHistory = evaluationData.conversationHistory || [];
        const studentTurns = conversationHistory.filter(turn => turn.speaker === 'student');
        const baseScore = Math.min(50, 25 + (studentTurns.length * 5));
        
        return {
            overallScore: baseScore,
            gradeRecommendation: this.scoreToGrade(baseScore),
            gradeDescription: this.getGradeDescription(baseScore),
            componentScores: {
                contentMastery: Math.max(30, baseScore - 5),
                technicalAccuracy: Math.max(25, baseScore - 10),
                completeness: Math.max(30, baseScore - 8),
                organizationClarity: Math.max(35, baseScore - 3),
                conceptualDepth: Math.max(25, baseScore - 12)
            },
            strengths: studentTurns.length > 0 ? ["Tentativo di partecipazione"] : [],
            criticalWeaknesses: ["Valutazione fallback attivata", "Preparazione insufficiente"],
            studyRecommendations: ["Studio approfondito necessario", "Ripetere l'esame con migliore preparazione"],
            feedback: {
                positive: "Presenza all'esame",
                constructive: "Necessaria preparazione molto più rigorosa",
                encouragement: "Con impegno serio può raggiungere risultati migliori"
            },
            penaltiesApplied: ["Valutazione automatica per insufficienza dati"],
            sessionQuality: "poor",
            evaluationComponents: {
                contentComparison: this.getFallbackContentComparison(),
                expositionQuality: this.getFallbackExpositionQuality(conversationHistory),
                combinedAnalysis: { overallCompleteness: baseScore }
            }
        };
    }

    setCurrentSession(sessionId) {
        this.currentSessionId = sessionId;
        console.log(`🔗 Holistic Evaluator session set: ${sessionId}`);
    }

    // Metodo di debug
    async debugEvaluation(evaluationData, options = {}) {
        console.log('🐛 Debug: Holistic evaluation process...');
        
        const startTime = Date.now();
        
        try {
            const result = await this.generateHolisticEvaluation(evaluationData);
            const processingTime = Date.now() - startTime;
            
            console.log('🐛 Evaluation completed in:', processingTime, 'ms');
            console.log('🐛 Final result:', {
                score: result.overallScore,
                grade: result.gradeRecommendation,
                penalties: result.penaltiesApplied?.length || 0
            });
            
            return {
                ...result,
                debugInfo: {
                    processingTimeMs: processingTime,
                    inputData: {
                    conversationTurns: evaluationData.conversationHistory?.length || 0,
                    pdfPages: evaluationData.pdfData?.analysisContext?.totalPages || 0
                    }
                }
            };
            
        } catch (error) {
            console.error('🐛 Debug evaluation failed:', error);
            throw error;
        }
    }
}

export default HolisticEvaluator;