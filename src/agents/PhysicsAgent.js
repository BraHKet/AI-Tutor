// ==========================================
// FILE: src/agents/PhysicsAgent.js (VERSIONE OLISTICA COMPLETA)
// ==========================================

import { createClient } from '@supabase/supabase-js';
import { PDFProcessor } from './modules/PDFProcessor.js';
import { ExaminationCoordinator } from './modules/ExaminationCoordinator.js';
import { ConversationManager } from './modules/ConversationManager.js';
import { HolisticEvaluator } from './modules/HolisticEvaluator.js';
import { PersonalityManager } from './modules/PersonalityManager.js';
import { LearningSystem } from './modules/LearningSystem.js';

export class PhysicsAgent {
    constructor(supabaseUrl, supabaseKey) {
        this.supabase = createClient(supabaseUrl, supabaseKey);
        this.agentId = null;
        this.agentProfile = null;
        
        // Nuovi moduli per approccio olistico
        this.pdfProcessor = new PDFProcessor();
        this.examinationCoordinator = new ExaminationCoordinator(this.supabase);
        this.conversationManager = new ConversationManager(this.supabase);
        this.holisticEvaluator = new HolisticEvaluator(this.supabase);
        this.personalityManager = new PersonalityManager(this.supabase);
        this.learningSystem = new LearningSystem(this.supabase);
        
        // Stato dell'esame olistico
        this.currentSession = null;
        this.processedPDF = null;
        this.initialRequest = null;
        this.treatmentAnalyses = []; // Tutte le analisi fatte durante l'esame
        this.isLearning = false;

        // Configurazione esame olistico
        this.holisticConfig = {
            maxFollowUpQuestions: 3,
            treatmentPhaseTimeout: 1800000, // 30 minuti
            evaluationMode: 'comprehensive', // comprehensive | focused
            severityLevel: 'university' // university | high_school
        };

        console.log('🎓 Physics AI Agent (Holistic Approach) initialized');
    }

    async initialize() {
        try {
            const { data, error } = await this.supabase
                .from('ai_agent_profiles')
                .insert({ 
                    agent_name: 'Holistic Physics Tutor AI', 
                    version: '3.0'
                })
                .select()
                .single();

            if (error && error.code === '23505') {
                const { data: existing, error: fetchError } = await this.supabase
                    .from('ai_agent_profiles')
                    .select('*')
                    .limit(1)
                    .single();
                if (fetchError) throw new Error("Failed to load existing agent profile.");
                this.agentProfile = existing;
            } else if (error) {
                throw new Error(`Failed to create or load agent profile: ${error.message}`);
            } else {
                this.agentProfile = data;
            }

            this.agentId = this.agentProfile.id;
            
            // Inizializza i moduli
            await this.examinationCoordinator.initialize(this.agentProfile);
            await this.holisticEvaluator.initialize(this.agentProfile);
            await this.personalityManager.initialize(this.agentProfile);
            await this.learningSystem.initialize(this.agentProfile);

            console.log(`🧠 Holistic Agent ${this.agentProfile.agent_name} ready (ID: ${this.agentId})`);
            return { success: true, agentId: this.agentId, approach: 'holistic' };
        } catch (error) {
            console.error('❌ Agent initialization failed:', error);
            throw error;
        }
    }

    // Elabora il PDF con il nuovo approccio Base64
    async analyzeMaterial(file, progressCallback = null) {
        try {
            progressCallback?.({ status: 'processing', message: 'Processing PDF with advanced analysis...' });
            
            let processedPDF;
            if (file.url) {
                processedPDF = await this.pdfProcessor.processPdfFromUrl(file.url, progressCallback);
            } else if (file.blob) {
                processedPDF = await this.pdfProcessor.processPdfFromBlob(file.blob, progressCallback);
            } else {
                throw new Error("Invalid file input: must provide either URL or blob");
            }

            // Prepara i dati per Gemini
            this.processedPDF = this.pdfProcessor.prepareForGemini(processedPDF, {
                filename: file.name,
                source: 'examination_material'
            });

            console.log(`✅ PDF processed: ${processedPDF.analysis.totalPages} pages, complexity: ${processedPDF.analysis.estimatedComplexity}`);
            
            // Salva i metadati del materiale
            const { data: material, error } = await this.supabase
                .from('uploaded_materials')
                .insert({
                    filename: file.name,
                    file_url: file.url || 'blob_upload',
                    processed_status: 'holistic_processed'
                })
                .select()
                .single();
            
            if (error) throw new Error(`Failed to store material metadata: ${error.message}`);

            return { 
                success: true, 
                materialId: material.id,
                analysis: processedPDF.analysis,
                recommendedApproach: this.processedPDF.analysisContext.recommendedApproach
            };
        } catch (error) {
            console.error('❌ Material analysis failed:', error);
            throw error;
        }
    }

    // Inizia l'esame olistico
    async startHolisticExamination(studentIdentifier, options = {}) {
        try {
            if (!this.processedPDF) {
                throw new Error("Material has not been processed yet. Call analyzeMaterial first.");
            }
            
            console.log('🎓 Starting holistic examination...');
            
            // Seleziona la personalità del professore
            const personality = await this.personalityManager.selectOptimalPersonality(
                null, 
                null, 
                options.personalityPreference
            );
            
            // Crea la sessione d'esame
            const { data: sessionData, error } = await this.supabase
                .from('examination_sessions')
                .insert({
                    agent_id: this.agentId,
                    professor_personality_type: personality.key
                })
                .select()
                .single();
            
            if (error) throw new Error(`Failed to create examination session: ${error.message}`);
            this.currentSession = sessionData;
            
            // Inizializza la conversazione
            await this.conversationManager.startConversation(
                this.currentSession.id,
                personality.key,
                []
            );
            
            this.holisticEvaluator.setCurrentSession(this.currentSession.id);
            
            // Genera la richiesta di trattazione completa
            try {
                this.initialRequest = await this.examinationCoordinator.generateInitialTreatmentRequest(
                    this.processedPDF,
                    personality
                );
            } catch (apiError) {
                console.warn('⚠️ Initial request generation failed, using fallback:', apiError.message);
                this.initialRequest = {
                    message: `Buongiorno. Mi faccia una trattazione completa e sistematica di tutto il contenuto presente nel materiale che ha studiato. Includa tutte le formule, le derivazioni, i grafici e i concetti presenti nel PDF, spiegando tutto dall'inizio alla fine in modo organizzato e dettagliato.`,
                    expectedElements: ["Concetti teorici fondamentali", "Formule e derivazioni matematiche", "Spiegazione di grafici e diagrammi", "Applicazioni pratiche", "Connessioni tra argomenti"],
                    evaluationCriteria: ["Completezza della trattazione", "Accuratezza tecnica", "Organizzazione logica", "Comprensione concettuale"],
                    estimatedDuration: "15-25 minuti",
                    type: 'comprehensive_treatment',
                    metadata: {
                        pdfAnalysis: this.processedPDF.analysisContext,
                        personality: personality.key,
                        generatedAt: new Date().toISOString(),
                        fallback: true
                    }
                };
            }
            
            // Registra la domanda iniziale
            await this.conversationManager.processTurn(
                'professor',
                this.initialRequest.message,
                { 
                    type: 'comprehensive_treatment_request',
                    expectedElements: this.initialRequest.expectedElements,
                    evaluationCriteria: this.initialRequest.evaluationCriteria
                }
            );
            
            console.log('✅ Holistic examination started successfully');
            
            return {
                success: true,
                sessionId: this.currentSession.id,
                message: this.initialRequest.message,
                personality: personality.name,
                expectedDuration: this.initialRequest.estimatedDuration,
                approach: 'holistic_treatment',
                metadata: {
                    expectedElements: this.initialRequest.expectedElements,
                    evaluationCriteria: this.initialRequest.evaluationCriteria,
                    pdfComplexity: this.processedPDF.analysisContext.complexity
                }
            };
        } catch (error) {
            console.error('❌ Failed to start holistic examination:', error);
            throw error;
        }
    }

    // Processa la risposta dello studente (trattazione o approfondimento)
    async processStudentTreatment(response, responseMetadata = {}) {
        try {
            if (!this.currentSession || !this.processedPDF || !this.initialRequest) {
                throw new Error('No active holistic examination session.');
            }

            console.log('🔍 Processing student treatment...');

            // Registra la risposta dello studente
            await this.conversationManager.processTurn(
                'student',
                response,
                { 
                    type: 'treatment_response',
                    phase: this.getExaminationPhase(),
                    ...responseMetadata
                }
            );
            
            const conversationHistory = this.conversationManager.getConversationHistory();
            
            // Controlla se siamo già al limite delle domande di approfondimento
            const followUpCount = conversationHistory.filter(turn => 
                turn.metadata?.type === 'follow_up_question'
            ).length;
            
            if (followUpCount >= this.holisticConfig.maxFollowUpQuestions) {
                console.log('📊 Maximum follow-ups reached, proceeding to final evaluation...');
                return await this.proceedToFinalEvaluation();
            }
            
            // Analisi semplificata locale per decidere se procedere alla valutazione
            const wordCount = response.trim().split(' ').length;
            const hasPhysicsTerms = this.checkForPhysicsContent(response);
            const isSubstantial = wordCount >= 100 && hasPhysicsTerms;
            
            if (isSubstantial && followUpCount >= 1) {
                // Se la risposta è sostanziale e abbiamo già fatto almeno un follow-up, procedi alla valutazione
                console.log('📊 Substantial response received, proceeding to final evaluation...');
                return await this.proceedToFinalEvaluation();
            }
            
            // Tenta l'analisi con Gemini, ma con fallback
            let treatmentAnalysis;
            try {
                treatmentAnalysis = await this.examinationCoordinator.analyzeTreatmentAndDecideNext(
                    response,
                    this.processedPDF,
                    this.initialRequest,
                    conversationHistory
                );
            } catch (apiError) {
                console.warn('⚠️ API analysis failed, using local fallback:', apiError.message);
                treatmentAnalysis = this.getLocalTreatmentAnalysis(response, followUpCount);
            }
            
            // Salva l'analisi
            this.treatmentAnalyses.push(treatmentAnalysis.analysis);
            
            // Registra l'osservazione per il sistema di apprendimento
            await this.observeInteraction(response, treatmentAnalysis.analysis);
            
            let professorResponse;
            
            // Decide l'azione basata sull'analisi
            switch (treatmentAnalysis.nextAction.type) {
                case 'final_evaluation':
                    // Procedi alla valutazione finale
                    return await this.proceedToFinalEvaluation();
                
                case 'targeted_follow_up':
                case 'general_follow_up':
                    try {
                        // Genera domanda di approfondimento
                        professorResponse = await this.examinationCoordinator.generateFollowUpQuestion(
                            treatmentAnalysis.analysis,
                            this.processedPDF,
                            treatmentAnalysis.nextAction,
                            await this.getCurrentPersonality(),
                            conversationHistory
                        );
                    } catch (apiError) {
                        console.warn('⚠️ Follow-up generation failed, using fallback:', apiError.message);
                        professorResponse = this.getFallbackFollowUpQuestion(treatmentAnalysis.nextAction);
                    }
                    break;
                
                case 'request_completion':
                    // Chiedi di completare la trattazione
                    professorResponse = {
                        message: `La sua trattazione necessita di maggiori dettagli. Per favore, approfondisca ulteriormente gli aspetti tecnici e le connessioni tra i concetti.`,
                        type: 'completion_request'
                    };
                    break;
                
                case 'correction_needed':
                    // Richiedi correzioni
                    professorResponse = {
                        message: `Può rivedere e chiarire alcuni aspetti della sua esposizione? Ci sono alcuni punti che necessitano di maggiore precisione.`,
                        type: 'correction_request'
                    };
                    break;
                
                default:
                    // Fallback
                    professorResponse = {
                        message: "Interessante. Può elaborare ulteriormente alcuni aspetti?",
                        type: 'general_follow_up'
                    };
            }
            
            // Registra la risposta del professore
            await this.conversationManager.processTurn(
                'professor',
                professorResponse.message,
                { 
                    type: professorResponse.type,
                    analysis: treatmentAnalysis.analysis,
                    nextAction: treatmentAnalysis.nextAction
                }
            );
            
            return {
                success: true,
                professorResponse: professorResponse.message,
                responseType: professorResponse.type,
                analysis: {
                    completeness: treatmentAnalysis.analysis.overallCompleteness || 70,
                    technicalAccuracy: treatmentAnalysis.analysis.technicalAccuracy || 65,
                    readyForEvaluation: treatmentAnalysis.readyForEvaluation,
                    phase: this.getExaminationPhase()
                },
                nextAction: treatmentAnalysis.nextAction.type
            };
        } catch (error) {
            console.error('❌ Failed to process student treatment:', error);
            return {
                success: false,
                professorResponse: `Si è verificato un errore nell'analisi. Può ripetere o riformulare la sua risposta?`,
                responseType: 'error',
                error: error.message
            };
        }
    }

    // Procede alla valutazione finale olistica
    async proceedToFinalEvaluation() {
        try {
            console.log('📊 Proceeding to final holistic evaluation...');

            // Prepara i dati per la valutazione
            const evaluationData = this.examinationCoordinator.prepareForFinalEvaluation(
                this.conversationManager.getConversationHistory(),
                this.processedPDF,
                this.treatmentAnalyses
            );

            let holisticEvaluation;
            try {
                // Tenta la valutazione con l'API
                holisticEvaluation = await this.holisticEvaluator.generateHolisticEvaluation(evaluationData);
            } catch (apiError) {
                console.warn('⚠️ API evaluation failed, using local evaluation:', apiError.message);
                holisticEvaluation = this.generateLocalEvaluation(evaluationData);
            }

            // Salva la valutazione nel database
            await this.storeHolisticEvaluation(holisticEvaluation);

            // Aggiorna lo stato della sessione
            await this.updateSessionStatus('completed', holisticEvaluation.overallScore);

            // Sistema di apprendimento
            await this.learnFromHolisticSession(this.currentSession, holisticEvaluation);

            // Messaggio finale del professore
            const finalMessage = this.generateFinalMessage(holisticEvaluation);
            
            await this.conversationManager.processTurn(
                'professor',
                finalMessage,
                { 
                    type: 'final_evaluation',
                    evaluation: holisticEvaluation
                }
            );

            // Completa la conversazione
            const conversationSummary = await this.conversationManager.completeConversation();

            const sessionId = this.currentSession.id;
            
            // Reset dello stato
            this.resetExaminationState();

            return {
                success: true,
                evaluation: {
                    overallScore: holisticEvaluation.overallScore,
                    gradeRecommendation: holisticEvaluation.gradeRecommendation,
                    gradeDescription: holisticEvaluation.gradeDescription,
                    componentScores: holisticEvaluation.componentScores,
                    strengths: holisticEvaluation.strengths,
                    criticalWeaknesses: holisticEvaluation.criticalWeaknesses,
                    studyRecommendations: holisticEvaluation.studyRecommendations,
                    feedback: holisticEvaluation.feedback,
                    sessionQuality: holisticEvaluation.sessionQuality
                },
                sessionSummary: conversationSummary,
                finalMessage: finalMessage,
                sessionId: sessionId
            };
        } catch (error) {
            console.error('❌ Failed to complete holistic evaluation:', error);
            throw new Error(`Holistic evaluation failed: ${error.message}`);
        }
    }

    generateFinalMessage(evaluation) {
        const grade = evaluation.gradeRecommendation;
        const description = evaluation.gradeDescription;
        
        let message = `Grazie per la sua trattazione. `;
        
        if (evaluation.overallScore >= 85) {
            message += `Complimenti! Ha dimostrato una preparazione ${description.toLowerCase()} (${grade}). `;
        } else if (evaluation.overallScore >= 70) {
            message += `Ha fornito una trattazione ${description.toLowerCase()} (${grade}). `;
        } else if (evaluation.overallScore >= 55) {
            message += `La sua preparazione è ${description.toLowerCase()} (${grade}). `;
        } else {
            message += `La preparazione risulta ${description.toLowerCase()}. `;
        }
        
        if (evaluation.strengths.length > 0) {
            message += `Punti di forza: ${evaluation.strengths.join(', ')}. `;
        }
        
        if (evaluation.criticalWeaknesses.length > 0) {
            message += `Aree da migliorare: ${evaluation.criticalWeaknesses.join(', ')}. `;
        }
        
        message += evaluation.feedback.encouragement;
        
        return message;
    }

    // Metodi di utilità
    getExaminationPhase() {
        const conversationHistory = this.conversationManager.getConversationHistory();
        const followUpCount = conversationHistory.filter(turn => 
            turn.metadata?.type === 'follow_up_question'
        ).length;
        
        if (followUpCount === 0) return 'initial_treatment';
        if (followUpCount < this.holisticConfig.maxFollowUpQuestions) return 'follow_up_phase';
        return 'final_phase';
    }

    async getCurrentPersonality() {
        const context = this.conversationManager.getCurrentContext();
        const personalityKey = context.professorPersonality;
        return { 
            key: personalityKey, 
            ...this.personalityManager.personalities[personalityKey] 
        };
    }

    resetExaminationState() {
        this.currentSession = null;
        this.processedPDF = null;
        this.initialRequest = null;
        this.treatmentAnalyses = [];
        this.conversationManager.resetContext();
        console.log('🔄 Examination state reset');
    }

    // Apprendimento del sistema
    async performLearningCycle() {
        try {
            console.log('🧠 Starting holistic learning cycle...');
            this.isLearning = true;
            const learningResult = await this.learningSystem.performSimpleLearningCycle();
            console.log(`📈 Holistic learning cycle completed: ${learningResult.improvementsMade || 0} improvements`);
            this.isLearning = false;
            return learningResult;
        } catch (error) {
            console.error('❌ Holistic learning cycle failed:', error);
            this.isLearning = false;
            throw new Error(`Learning failed: ${error.message}`);
        }
    }

    async getPerformanceStats() {
        try {
            if (!this.agentId) return { message: "Agent not initialized" };
            
            const { data: sessions } = await this.supabase
                .from('examination_sessions')
                .select('overall_performance_score, student_satisfaction_score')
                .eq('agent_id', this.agentId)
                .not('overall_performance_score', 'is', null);
            
            if (!sessions || sessions.length === 0) {
                return { 
                    totalSessions: 0, 
                    averagePerformance: 0, 
                    studentSatisfaction: 0,
                    holisticSessions: 0
                };
            }
            
            const avgPerformance = sessions.reduce((sum, s) => 
                sum + (s.overall_performance_score || 0), 0
            ) / sessions.length;
            
            const avgSatisfaction = sessions.reduce((sum, s) => 
                sum + (s.student_satisfaction_score || 0), 0
            ) / sessions.length;
            
            return { 
                totalSessions: sessions.length,
                holisticSessions: sessions.length, // Ora tutte le sessioni sono considerate olistiche
                averagePerformance: Math.round(avgPerformance * 10) / 10,
                studentSatisfaction: Math.round(avgSatisfaction * 10) / 10,
                isLearning: this.isLearning,
                approach: 'holistic'
            };
        } catch (error) {
            console.error('❌ Failed to get performance stats:', error);
            return null;
        }
    }

    // Metodi privati helper
    async storeHolisticEvaluation(evaluation) {
        try {
            const { error } = await this.supabase
                .from('exposition_evaluations')
                .insert({
                    session_id: this.currentSession.id,
                    completeness_score: evaluation.overallScore,
                    technical_accuracy_score: evaluation.componentScores?.technicalAccuracy || evaluation.overallScore,
                    logical_flow_score: evaluation.componentScores?.organizationClarity || evaluation.overallScore,
                    conceptual_understanding_score: evaluation.componentScores?.conceptualDepth || evaluation.overallScore,
                    overall_assessment: evaluation.feedback?.positive || 'Valutazione olistica completata',
                    grade_suggested: evaluation.gradeRecommendation
                });
            
            if (error) {
                console.error('❌ Failed to store holistic evaluation:', error);
            } else {
                console.log('✅ Holistic evaluation stored successfully');
            }
        } catch (error) {
            console.error('❌ Error storing holistic evaluation:', error);
        }
    }

    async updateSessionStatus(status, finalScore = null) {
        try {
            const updateData = { 
                session_phase: status, 
                end_time: new Date().toISOString()
            };
            
            if (finalScore) {
                updateData.overall_performance_score = finalScore;
            }
            
            const { error } = await this.supabase
                .from('examination_sessions')
                .update(updateData)
                .eq('id', this.currentSession.id);
            
            if (error) {
                console.error('❌ Failed to update session status:', error);
            }
        } catch (error) {
            console.error('❌ Error updating session status:', error);
        }
    }

    async observeInteraction(studentResponse, analysis) {
        if (!this.learningSystem) return;
        
        try {
            await this.learningSystem.recordObservation({
                observation_type: 'holistic_treatment_analysis',
                observation_data: {
                    student_completeness: analysis.overallCompleteness,
                    technical_accuracy: analysis.technicalAccuracy,
                    missing_elements_count: analysis.missingElements?.length || 0,
                    treatment_phase: this.getExaminationPhase()
                },
                success_metrics: {
                    content_coverage: analysis.contentCoverage,
                    organization_flow: analysis.organizationFlow,
                    conceptual_depth: analysis.conceptualDepth
                },
                context_factors: {
                    session_id: this.currentSession?.id,
                    pdf_complexity: this.processedPDF?.analysisContext?.complexity || 'unknown'
                }
            });
        } catch (error) {
            console.error('❌ Failed to record interaction observation:', error);
        }
    }

    async learnFromHolisticSession(session, evaluation) {
        if (!this.learningSystem) return;
        
        try {
            await this.learningSystem.recordObservation({
                observation_type: 'holistic_session_completion',
                observation_data: {
                    final_score: evaluation.overallScore,
                    session_quality: evaluation.sessionQuality,
                    personality_used: session.professor_personality_type,
                    component_scores: evaluation.componentScores,
                    penalties_applied: evaluation.penaltiesApplied?.length || 0
                },
                success_metrics: {
                    student_satisfaction: evaluation.sessionQuality === 'excellent' ? 95 : 
                                         evaluation.sessionQuality === 'good' ? 80 :
                                         evaluation.sessionQuality === 'adequate' ? 65 : 50,
                    evaluation_confidence: evaluation.evaluationComponents ? 90 : 70
                },
                context_factors: {
                    session_id: session.id,
                    pdf_complexity: this.processedPDF?.analysisContext?.complexity || 'unknown'
                }
            });
        } catch (error) {
            console.error('❌ Failed to record session learning observation:', error);
        }
    }

    // Metodi di fallback per quando l'API Gemini fallisce
    getLocalTreatmentAnalysis(response, followUpCount) {
        const wordCount = response.trim().split(' ').length;
        const hasPhysicsTerms = this.checkForPhysicsContent(response);
        const hasNumbers = /\d/.test(response);
        const hasFormulas = /[=+\-*/^²³]/.test(response);
        
        // Analisi locale basata su euristics
        let baseScore = 50;
        if (wordCount >= 100) baseScore += 15;
        if (wordCount >= 200) baseScore += 10;
        if (hasPhysicsTerms) baseScore += 15;
        if (hasNumbers) baseScore += 10;
        if (hasFormulas) baseScore += 10;
        
        const completeness = Math.min(85, baseScore);
        
        // Decide la prossima azione
        let nextActionType = 'final_evaluation';
        if (completeness < 60 && followUpCount < 2) {
            nextActionType = 'general_follow_up';
        } else if (followUpCount < 1 && completeness < 80) {
            nextActionType = 'targeted_follow_up';
        }
        
        return {
            analysis: {
                overallCompleteness: completeness,
                technicalAccuracy: Math.max(40, completeness - 10),
                contentCoverage: completeness,
                organizationFlow: Math.max(50, completeness - 5),
                conceptualDepth: Math.max(45, completeness - 15),
                missingElements: completeness < 70 ? ['Maggiori dettagli tecnici'] : [],
                strengths: wordCount > 150 ? ['Esposizione dettagliata'] : ['Partecipazione'],
                estimatedComprehension: completeness >= 75 ? 'good' : 'basic'
            },
            nextAction: {
                type: nextActionType,
                reason: 'Local analysis fallback'
            },
            readyForEvaluation: nextActionType === 'final_evaluation'
        };
    }

    getFallbackFollowUpQuestion(nextAction) {
        const questions = [
            "Può approfondire meglio gli aspetti teorici più importanti?",
            "Quali sono le applicazioni pratiche principali di questi concetti?",
            "Può spiegare le derivazioni matematiche più rilevanti?",
            "Come si collegano tra loro i diversi argomenti che ha trattato?",
            "Può fornire più dettagli sui principi fisici fondamentali?"
        ];
        
        const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
        
        return {
            message: randomQuestion,
            type: 'follow_up_question',
            followUpType: 'general',
            targetedElements: ['Approfondimento generale'],
            expectedDepth: 'intermediate'
        };
    }

    generateLocalEvaluation(evaluationData) {
        const conversationHistory = evaluationData.conversationHistory || [];
        const studentTurns = conversationHistory.filter(turn => turn.speaker === 'student');
        
        // Analisi locale della performance
        const totalWords = studentTurns.reduce((total, turn) => 
            total + turn.content.split(' ').length, 0
        );
        const avgResponseLength = totalWords / (studentTurns.length || 1);
        
        let baseScore = 60; // Punteggio base conservativo
        
        // Aggiustamenti basati sulla partecipazione
        if (totalWords >= 300) baseScore += 10;
        if (totalWords >= 500) baseScore += 5;
        if (avgResponseLength >= 100) baseScore += 5;
        if (studentTurns.length >= 2) baseScore += 5;
        
        // Verifica contenuto tecnico
        const allContent = studentTurns.map(turn => turn.content).join(' ');
        if (this.checkForPhysicsContent(allContent)) baseScore += 10;
        
        const finalScore = Math.min(85, Math.max(50, baseScore)); // Limitato tra 50-85 per fallback
        
        return {
            overallScore: finalScore,
            gradeRecommendation: this.scoreToGrade(finalScore),
            gradeDescription: this.getGradeDescription(finalScore),
            componentScores: {
                contentMastery: finalScore,
                technicalAccuracy: Math.max(45, finalScore - 10),
                completeness: Math.max(50, finalScore - 5),
                organizationClarity: Math.max(55, finalScore),
                conceptualDepth: Math.max(45, finalScore - 15)
            },
            strengths: totalWords > 200 ? ['Partecipazione attiva', 'Esposizione dettagliata'] : ['Partecipazione'],
            criticalWeaknesses: ['Valutazione automatica - API non disponibile'],
            studyRecommendations: ['Continuare a praticare l\'esposizione orale', 'Approfondire gli aspetti tecnici'],
            feedback: {
                positive: "Ha partecipato attivamente all'esame",
                constructive: "La valutazione automatica suggerisce di continuare a studiare",
                encouragement: "Con la pratica costante può migliorare le proprie competenze"
            },
            sessionQuality: finalScore >= 70 ? 'good' : 'adequate',
            penaltiesApplied: ['Valutazione di fallback utilizzata']
        };
    }

    checkForPhysicsContent(text) {
        const physicsTerms = [
            'energia', 'forza', 'velocità', 'accelerazione', 'massa', 'pressione', 'temperatura',
            'campo', 'onda', 'frequenza', 'potenza', 'lavoro', 'momento', 'impulso', 'attrito',
            'gravità', 'elettrico', 'magnetico', 'calore', 'termodinamica', 'meccanica',
            'joule', 'newton', 'watt', 'volt', 'ampere', 'metro', 'secondo', 'chilogrammo',
            'formula', 'legge', 'principio', 'teorema', 'equazione', 'calcolo', 'derivata',
            'integrale', 'fisica', 'dinamica', 'cinematica', 'ottica', 'acustica'
        ];
        
        const lowerText = text.toLowerCase();
        return physicsTerms.some(term => lowerText.includes(term));
    }

    scoreToGrade(score) {
        if (score >= 95) return "30/30";
        if (score >= 90) return "29/30";
        if (score >= 85) return "28/30";
        if (score >= 80) return "27/30";
        if (score >= 75) return "26/30";
        if (score >= 70) return "25/30";
        if (score >= 65) return "24/30";
        if (score >= 60) return "23/30";
        if (score >= 55) return "22/30";
        if (score >= 50) return "21/30";
        return "Insufficiente";
    }

    getGradeDescription(score) {
        if (score >= 90) return "Eccellente";
        if (score >= 80) return "Ottimo";
        if (score >= 70) return "Buono";
        if (score >= 60) return "Sufficiente";
        if (score >= 50) return "Appena sufficiente";
        return "Insufficiente";
    }

    // Metodo di debug per testare il workflow completo
    async debugHolisticWorkflow(file, studentResponse, options = {}) {
        console.log('🐛 Debug: Testing complete holistic workflow...');
        
        try {
            // 1. Analizza il materiale
            console.log('🐛 Step 1: Analyzing material...');
            const materialAnalysis = await this.analyzeMaterial(file);
            
            // 2. Inizia l'esame
            console.log('🐛 Step 2: Starting examination...');
            const examStart = await this.startHolisticExamination('debug-student', options);
            
            // 3. Processa la risposta dello studente (se fornita)
            let treatmentResult = null;
            if (studentResponse) {
                console.log('🐛 Step 3: Processing student treatment...');
                treatmentResult = await this.processStudentTreatment(studentResponse);
                
                // 4. Se è pronto per la valutazione, completa l'esame
                if (treatmentResult.analysis?.readyForEvaluation) {
                    console.log('🐛 Step 4: Completing evaluation...');
                    const finalEvaluation = await this.proceedToFinalEvaluation();
                    
                    return {
                        materialAnalysis,
                        examStart,
                        treatmentResult,
                        finalEvaluation,
                        debugInfo: {
                            pdfComplexity: this.processedPDF?.analysisContext?.complexity,
                            workflowCompleted: true
                        }
                    };
                }
            }
            
            return {
                materialAnalysis,
                examStart,
                treatmentResult,
                debugInfo: {
                    pdfComplexity: this.processedPDF?.analysisContext?.complexity,
                    workflowCompleted: false,
                    nextStep: treatmentResult ? 'continue_treatment' : 'provide_student_response'
                }
            };
            
        } catch (error) {
            console.error('🐛 Debug workflow failed:', error);
            throw error;
        }
    }
}

export default PhysicsAgent;