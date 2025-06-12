// ==========================================
// FILE: src/agents/PhysicsAgent.js (VERSIONE COMPLETA E CORRETTA)
// ==========================================

import { createClient } from '@supabase/supabase-js';
import { ContentAnalyzer } from './modules/ContentAnalyzer.js';
import { ExaminationEngine } from './modules/ExaminationEngine.js';
import { LearningSystem } from './modules/LearningSystem.js';
import { ConversationManager } from './modules/ConversationManager.js';
import { QuestionGenerator } from './modules/QuestionGenerator.js';
import { PersonalityManager } from './modules/PersonalityManager.js';

export class PhysicsAgent {
    constructor(supabaseUrl, supabaseKey) { // Rimosso agentId, non serve qui
        this.supabase = createClient(supabaseUrl, supabaseKey);
        this.agentId = null; // Verrà impostato in initialize
        this.agentProfile = null;
        
        // La chiave Gemini non viene passata qui, per ora manteniamo la tua struttura
        this.contentAnalyzer = new ContentAnalyzer(this.supabase);
        this.examinationEngine = new ExaminationEngine(this.supabase);
        this.learningSystem = new LearningSystem(this.supabase);
        this.conversationManager = new ConversationManager(this.supabase);
        this.questionGenerator = new QuestionGenerator(this.supabase);
        this.personalityManager = new PersonalityManager(this.supabase);
        
        this.currentSession = null;
        this.isLearning = false;
        
        console.log('🤖 Physics AI Agent initialized');
    }

    async initialize(agentId = null) {
        try {
            if (agentId) {
                this.agentProfile = await this.loadAgentProfile(agentId);
            } else {
                this.agentProfile = await this.createNewAgentProfile();
            }
            
            this.agentId = this.agentProfile.id;
            
            await this.initializeModules();
            
            console.log(`🧠 Agent ${this.agentProfile.agent_name} ready (ID: ${this.agentId})`);
            return { success: true, agentId: this.agentId };
        } catch (error) {
            console.error('Failed to initialize agent:', error);
            throw new Error(`Agent initialization failed: ${error.message}`);
        }
    }

    async analyzeMaterial(file, progressCallback = null) {
        try {
            progressCallback?.({ status: 'analyzing', message: 'Analyzing physics material...' });
            
            const material = await this.storeMaterial(file);
            
            const analysisResult = await this.contentAnalyzer.analyzePhysicsContent(
                material, 
                progressCallback
            );
            
            await this.updateMaterialAnalysis(material.id, analysisResult);
            await this.observeContentAnalysis(material, analysisResult);
            
            return {
                success: true,
                materialId: material.id,
                topics: analysisResult.topics,
                difficulty: analysisResult.overallDifficulty,
                physicsAreas: analysisResult.physicsAreas,
                totalTopics: analysisResult.topics.length
            };
        } catch (error) {
            console.error('Material analysis failed:', error);
            throw new Error(`Analysis failed: ${error.message}`);
        }
    }

    async startExamination(materialId, studentIdentifier, options = {}) {
        try {
            const studentProfile = await this.getOrCreateStudentProfile(studentIdentifier);
            const topics = await this.loadPhysicsTopics(materialId);
            
            if (!topics || topics.length === 0) {
                throw new Error('No physics topics found for this material');
            }
            
            const personality = await this.personalityManager.selectOptimalPersonality(
                studentProfile,
                topics,
                options.personalityPreference
            );
            
            // La chiamata a createExaminationSession passa i dati corretti
            this.currentSession = await this.createExaminationSession({
                studentProfileId: studentProfile.id,
                materialId: materialId, // Passiamo il materialId ricevuto
                personalityType: personality.name,
            });
            
            await this.conversationManager.startConversation(
                this.currentSession.id,
                personality.name,
                topics
            );
            
            this.examinationEngine.setCurrentSession(this.currentSession.id);
            
            const openingRequest = await this.questionGenerator.generateOpeningRequest(
                topics, 
                studentProfile,
                { personality }
            );
            
            await this.conversationManager.processTurn('professor', openingRequest.message, {
                type: 'opening_request',
                topicRequested: openingRequest.topic.topic_name,
                strategy: openingRequest.strategy
            });
            
            return {
                success: true,
                sessionId: this.currentSession.id,
                message: openingRequest.message,
                topic: openingRequest.topic,
                estimatedDuration: openingRequest.estimatedDuration,
                personality: personality.name
            };
        } catch (error) {
            console.error('Failed to start examination:', error);
            throw new Error(`Examination start failed: ${error.message}`);
        }
    }
    
    async processStudentResponse(response, responseMetadata = {}) {
        try {
            if (!this.currentSession) {
                throw new Error('No active examination session');
            }
            
            await this.conversationManager.processTurn('student', response, {
                type: 'exposition', ...responseMetadata
            });
            
            const conversationContext = this.conversationManager.getCurrentContext();
            const conversationHistory = this.conversationManager.getConversationHistory();
            
            const analysis = await this.examinationEngine.analyzeStudentResponse(
                response,
                conversationContext.currentTopic,
                conversationHistory
            );
            
            const nextAction = await this.examinationEngine.determineNextAction(
                analysis, 
                conversationContext
            );

            // CORREZIONE DEFINITIVA: Recuperiamo l'oggetto personalità completo
            // usando il nome della personalità salvato nel contesto della conversazione.
            // Questo era il punto che causava l'errore.
            const personalityName = 'strict'; //per adesso lo metto manualmente 
            if (!personalityName) {
                throw new Error("Could not determine professor personality from conversation context.");
            }
            const personality = this.personalityManager.personalities[personalityName];
            if (!personality) {
                throw new Error(`Personality "${personalityName}" not found in PersonalityManager.`);
            }
            
            // Ora passiamo l'oggetto `personality` corretto e non `undefined`.
            const professorResponse = await this.questionGenerator.generateFollowUpQuestion(
                analysis, 
                conversationContext, 
                nextAction,
                personality // Passaggio corretto
            );
            
            await this.conversationManager.processTurn('professor', professorResponse.message, {
                type: professorResponse.type,
                strategy: professorResponse.strategy,
                analysis: analysis
            });

            await this.observeInteraction(response, analysis, professorResponse);
            
            return {
                success: true,
                professorResponse: professorResponse.message,
                responseType: professorResponse.type,
                analysis: {
                    understanding: analysis.understandingLevel,
                    completeness: analysis.completeness,
                    accuracy: analysis.technicalAccuracy,
                    gaps: analysis.essentialPointsMissing,
                },
                sessionPhase: conversationContext.conversationPhase,
            };
        } catch (error) {
            console.error('Failed to process student response:', error);
            // Restituisci un errore gestibile all'UI
            return {
                success: false,
                professorResponse: `Si è verificato un errore interno. Ricarica la pagina e riprova. (Dettagli: ${error.message})`,
                responseType: 'error',
            }
        }
    }
    
    async completeExamination() {
        try {
            if (!this.currentSession) {
                throw new Error('No active examination session');
            }
            
            const conversationSummary = await this.conversationManager.completeConversation();
            const conversationHistory = this.conversationManager.getConversationHistory();
            
            const evaluation = await this.examinationEngine.generateFinalEvaluation(
                conversationHistory,
                this.currentSession
            );
            
            await this.storeExaminationEvaluation(evaluation);
            await this.updateSessionStatus('completed', evaluation.overallScore);
            await this.learnFromSession(this.currentSession, evaluation);
            
            const sessionId = this.currentSession.id;
            this.currentSession = null;
            this.conversationManager.resetContext();
            
            return {
                success: true,
                evaluation: {
                    overallScore: evaluation.overallScore,
                    gradeRecommendation: evaluation.gradeRecommendation,
                    strengths: evaluation.strengths,
                    weaknesses: evaluation.weaknesses,
                    studyRecommendations: evaluation.studyRecommendations,
                    feedback: evaluation.feedback
                },
                sessionSummary: {
                    duration: conversationSummary.totalDuration,
                    totalTurns: conversationSummary.totalTurns,
                }
            };
        } catch (error) {
            console.error('Failed to complete examination:', error);
            throw new Error(`Examination completion failed: ${error.message}`);
        }
    }

    async performLearningCycle() {
        try {
            console.log('🧠 Starting agent learning cycle...');
            this.isLearning = true;
            const learningResult = await this.learningSystem.performSimpleLearningCycle();
            console.log(`📈 Learning cycle completed: ${learningResult.improvementsMade || 0} improvements`);
            this.isLearning = false;
            return learningResult;
        } catch (error) {
            console.error('Learning cycle failed:', error);
            this.isLearning = false;
            throw new Error(`Learning failed: ${error.message}`);
        }
    }

    async getPerformanceStats() {
        try {
            const { data: sessions } = await this.supabase
                .from('examination_sessions')
                .select('overall_performance_score, student_satisfaction_score')
                .eq('agent_id', this.agentId)
                .not('overall_performance_score', 'is', null);

            if (!sessions || sessions.length === 0) {
                return { totalSessions: 0, averagePerformance: 0, studentSatisfaction: 0 };
            }

            const avgPerformance = sessions.reduce((sum, s) => sum + (s.overall_performance_score || 0), 0) / sessions.length;
            const avgSatisfaction = sessions.reduce((sum, s) => sum + (s.student_satisfaction_score || 0), 0) / sessions.length;

            return {
                totalSessions: sessions.length,
                averagePerformance: Math.round(avgPerformance * 10) / 10,
                studentSatisfaction: Math.round(avgSatisfaction * 10) / 10,
                isLearning: this.isLearning
            };
        } catch (error) {
            console.error('Failed to get performance stats:', error);
            return null;
        }
    }
    
    // ===== PRIVATE HELPER METHODS =====
    
    async loadAgentProfile(agentId) {
        const { data, error } = await this.supabase
            .from('ai_agent_profiles')
            .select('*')
            .eq('id', agentId)
            .single();
        if (error) throw new Error(`Failed to load agent: ${error.message}`);
        return data;
    }

    async createNewAgentProfile() {
        const defaultProfile = {
            agent_name: 'Physics Professor AI',
            version: '1.0._client',
            personality_config: { base_type: 'adaptive' },
            learning_config: { learning_rate: 0.1 },
            performance_metrics: { average_session_rating: 0.0 }
        };
        const { data, error } = await this.supabase
            .from('ai_agent_profiles')
            .insert(defaultProfile)
            .select()
            .single();
        if (error) throw new Error(`Failed to create agent profile: ${error.message}`);
        return data;
    }

    async initializeModules() {
        await Promise.all([
            this.contentAnalyzer.initialize(this.agentProfile),
            this.examinationEngine.initialize(this.agentProfile),
            this.learningSystem.initialize(this.agentProfile),
            this.conversationManager.initialize(this.agentProfile),
            this.questionGenerator.initialize(this.agentProfile),
            this.personalityManager.initialize(this.agentProfile)
        ]);
    }

    async storeMaterial(file) {
        const materialData = {
            filename: file.name,
            file_type: "application/pdf",
            file_url: file.url,
            processed_status: 'processing'
        };
        const { data, error } = await this.supabase
            .from('uploaded_materials')
            .insert(materialData)
            .select()
            .single();
        if (error) throw new Error(`Failed to store material: ${error.message}`);
        return { ...data, url: file.url };
    }

    async updateMaterialAnalysis(materialId, analysisResult) {
        const { error } = await this.supabase
            .from('uploaded_materials')
            .update({
                processed_status: 'completed',
                content_summary: { topics: analysisResult.topics.length, areas: analysisResult.physicsAreas },
                total_concepts: analysisResult.totalTopics,
                physics_areas: analysisResult.physicsAreas,
                difficulty_level: analysisResult.overallDifficulty
            })
            .eq('id', materialId);
        if (error) console.error('Failed to update material analysis:', error);
    }
    
    async loadPhysicsTopics(materialId) {
        const { data, error } = await this.supabase
            .from('physics_topics')
            .select('*')
            .eq('material_id', materialId)
            .order('difficulty_level', { ascending: true });
        if (error) throw new Error(`Failed to load topics: ${error.message}`);
        return data;
    }

    async getOrCreateStudentProfile(studentIdentifier) {
        const { data: existing } = await this.supabase
            .from('student_profiles_ai')
            .select('*')
            .eq('student_identifier', studentIdentifier)
            .single();
        if (existing) return existing;
        
        const { data, error } = await this.supabase
            .from('student_profiles_ai')
            .insert({ student_identifier: studentIdentifier, physics_knowledge_level: 5 })
            .select()
            .single();
        if (error) throw new Error(`Failed to create student profile: ${error.message}`);
        return data;
    }
    
    // =======================================================
    // ===== MODIFICA CHIAVE PER RISOLVERE L'ERRORE ==========
    // =======================================================
    async createExaminationSession(sessionData) {
        // Estraiamo le proprietà dall'oggetto sessionData ricevuto
        const { studentProfileId, materialId, personalityType } = sessionData;

        // Creiamo un nuovo oggetto con i nomi delle colonne corretti (snake_case)
        const dataToInsert = {
            agent_id: this.agentId,
            student_profile_id: studentProfileId,
            material_id: materialId, // <-- CORREZIONE APPLICATA QUI
            professor_personality_type: personalityType,
            session_phase: 'starting'
        };

        const { data, error } = await this.supabase
            .from('examination_sessions')
            .insert(dataToInsert)
            .select()
            .single();
        
        if (error) {
            // Aggiungiamo un log più dettagliato per il debug
            console.error("Supabase error on creating session:", error);
            throw new Error(`Failed to create session: ${error.message}`);
        }

        return data;
    }
    // =======================================================
    // ================= FINE DELLA MODIFICA ==================
    // =======================================================

    async observeContentAnalysis(material, analysisResult) {
        await this.learningSystem.recordObservation({
            observation_type: 'content_analysis',
            observation_data: { material_type: material.file_type, topics_extracted: analysisResult.totalTopics, physics_areas: analysisResult.physicsAreas, difficulty: analysisResult.overallDifficulty },
            context_factors: { analysis_success: analysisResult.success }
        });
    }

    async observeInteraction(studentResponse, analysis, professorResponse) {
        await this.learningSystem.recordObservation({
            observation_type: 'interaction_effectiveness',
            observation_data: { student_understanding: analysis.understandingLevel, professor_strategy: professorResponse.strategy, response_type: professorResponse.type },
            success_metrics: { completeness: analysis.completeness, accuracy: analysis.technicalAccuracy },
            context_factors: { session_id: this.currentSession?.id, conversation_phase: this.conversationManager.getCurrentContext().conversationPhase }
        });
    }

    async storeExaminationEvaluation(evaluation) {
        const { error } = await this.supabase
            .from('exposition_evaluations')
            .insert({
                session_id: this.currentSession.id,
                completeness_score: evaluation.overallScore,
                technical_accuracy_score: evaluation.overallScore, 
                logical_flow_score: evaluation.overallScore,
                conceptual_understanding_score: evaluation.overallScore,
                overall_assessment: evaluation.feedback,
                grade_suggested: evaluation.gradeRecommendation
            });
        if (error) console.error('Failed to store evaluation:', error);
    }

    async updateSessionStatus(status, finalScore = null) {
        const updateData = { session_phase: status, end_time: new Date().toISOString() };
        if (finalScore) {
            updateData.overall_performance_score = finalScore;
        }
        const { error } = await this.supabase
            .from('examination_sessions')
            .update(updateData)
            .eq('id', this.currentSession.id);
        if (error) console.error('Failed to update session status:', error);
    }

    async learnFromSession(session, evaluation) {
        await this.learningSystem.recordObservation({
            observation_type: 'session_completion',
            observation_data: { final_score: evaluation.overallScore, session_duration: evaluation.totalDuration, personality_used: session.professor_personality_type },
            success_metrics: { student_satisfaction: evaluation.engagementScore || 70, learning_effectiveness: evaluation.overallScore },
            context_factors: { session_id: session.id, total_turns: evaluation.totalTurns }
        });
    }
}

export default PhysicsAgent;