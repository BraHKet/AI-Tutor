// ==========================================
// FILE: src/agents/PhysicsAgent.js (100% COMPLETO E CORRETTO)
// ==========================================

import { createClient } from '@supabase/supabase-js';
import { TextExtractor } from './modules/TextExtractor.js';
import { ExaminationEngine } from './modules/ExaminationEngine.js';
import { ConversationManager } from './modules/ConversationManager.js';
import { QuestionGenerator } from './modules/QuestionGenerator.js';
import { PersonalityManager } from './modules/PersonalityManager.js';
import { LearningSystem } from './modules/LearningSystem.js';

export class PhysicsAgent {
    constructor(supabaseUrl, supabaseKey) {
        this.supabase = createClient(supabaseUrl, supabaseKey);
        this.agentId = null;
        this.agentProfile = null;
        
        this.textExtractor = new TextExtractor();
        this.examinationEngine = new ExaminationEngine(this.supabase);
        this.conversationManager = new ConversationManager(this.supabase);
        this.questionGenerator = new QuestionGenerator(this.supabase);
        this.personalityManager = new PersonalityManager(this.supabase);
        this.learningSystem = new LearningSystem(this.supabase);
        
        this.currentSession = null;
        this.pdfTextContent = null;
        this.isLearning = false;

        console.log('🤖 Physics AI Agent (Text-Based) initialized');
    }

    async initialize() {
        const { data, error } = await this.supabase
            .from('ai_agent_profiles')
            .insert({ agent_name: 'Text-Based Tutor AI', version: '2.0' })
            .select()
            .single();

        if (error && error.code === '23505') {
            const { data: existing, error: fetchError } = await this.supabase.from('ai_agent_profiles').select('*').limit(1).single();
            if (fetchError) throw new Error("Failed to load existing agent profile.");
            this.agentProfile = existing;
        } else if (error) {
            throw new Error(`Failed to create or load agent profile: ${error.message}`);
        } else {
            this.agentProfile = data;
        }

        this.agentId = this.agentProfile.id;
        
        await this.examinationEngine.initialize(this.agentProfile);
        await this.questionGenerator.initialize(this.agentProfile);
        await this.personalityManager.initialize(this.agentProfile);
        await this.learningSystem.initialize(this.agentProfile);

        console.log(`🧠 Agent ${this.agentProfile.agent_name} ready (ID: ${this.agentId})`);
        return { success: true, agentId: this.agentId };
    }

    async analyzeMaterial(file, progressCallback = null) {
        try {
            progressCallback?.({ status: 'extracting', message: 'Extracting text from material...' });
            const extractedText = await this.textExtractor.extractTextFromPdfUrl(file.url, progressCallback);
            this.pdfTextContent = extractedText;
            console.log(`✅ Text extracted, ${this.pdfTextContent.length} characters long.`);
            
            const { data: material, error } = await this.supabase.from('uploaded_materials').insert({ filename: file.name, file_url: file.url, processed_status: 'text_extracted' }).select().single();
            if (error) throw new Error(`Failed to store material metadata: ${error.message}`);

            return { success: true, materialId: material.id };
        } catch (error) {
            console.error('Material text extraction failed:', error);
            throw error;
        }
    }

    async startExamination(studentIdentifier, options = {}) {
        try {
            if (!this.pdfTextContent) throw new Error("Material has not been analyzed yet. Call analyzeMaterial first.");
            
            const personality = await this.personalityManager.selectOptimalPersonality(null, null, options.personalityPreference);
            
            const { data: sessionData, error } = await this.supabase.from('examination_sessions').insert({ agent_id: this.agentId, professor_personality_type: personality.key }).select().single();
            if (error) throw new Error(`Failed to create examination session in database: ${error.message}`);
            this.currentSession = sessionData;
            
            await this.conversationManager.startConversation(this.currentSession.id, personality.key, []);
            this.examinationEngine.setCurrentSession(this.currentSession.id);
            
            const openingRequest = await this.questionGenerator.generateOpeningRequest(this.pdfTextContent, personality);
            await this.conversationManager.processTurn('professor', openingRequest.message, { type: 'opening_request' });
            
            return {
                success: true,
                sessionId: this.currentSession.id,
                message: openingRequest.message,
                personality: personality.name
            };
        } catch (error) {
            console.error('Failed to start examination:', error);
            throw error;
        }
    }
    
    async processStudentResponse(response, responseMetadata = {}) {
        try {
            if (!this.currentSession || !this.pdfTextContent) throw new Error('No active examination session or PDF text loaded.');

            await this.conversationManager.processTurn('student', response, { type: 'exposition', ...responseMetadata });
            
            const conversationHistory = this.conversationManager.getConversationHistory();
            const conversationContext = this.conversationManager.getCurrentContext();
            
            const analysis = await this.examinationEngine.analyzeStudentResponse(response, null, conversationHistory);
            
            const personalityKey = conversationContext.professorPersonality;
            if (!personalityKey) throw new Error("Could not determine personality from context. The session may have been reset.");
            
            const personality = this.personalityManager.personalities[personalityKey];
            if (!personality) throw new Error(`Personality key "${personalityKey}" is not a valid key in PersonalityManager.`);
            
            const nextAction = await this.examinationEngine.determineNextAction(analysis, conversationContext);
            const professorResponse = await this.questionGenerator.generateFollowUpQuestion(analysis, conversationHistory, this.pdfTextContent, personality, nextAction); // Passato nextAction
                
            await this.conversationManager.processTurn('professor', professorResponse.message, { type: professorResponse.type, analysis: analysis });
            
            await this.observeInteraction(response, analysis, professorResponse);

            return {
                success: true,
                professorResponse: professorResponse.message,
                responseType: professorResponse.type,
                analysis: {
                    understanding: analysis.understandingLevel,
                    completeness: analysis.completeness,
                    accuracy: analysis.technicalAccuracy,
                }
            };
        } catch (error) {
            console.error("Failed to process student response:", error);
            return {
                success: false,
                professorResponse: `An internal error occurred. (Details: ${error.message})`,
                responseType: 'error'
            };
        }
    }
    
    async completeExamination() {
        try {
            if (!this.currentSession) throw new Error('No active examination session');
            const conversationSummary = await this.conversationManager.completeConversation();
            const conversationHistory = this.conversationManager.getConversationHistory();
            const evaluation = await this.examinationEngine.generateFinalEvaluation(conversationHistory, this.currentSession);
            await this.storeExaminationEvaluation(evaluation);
            await this.updateSessionStatus('completed', evaluation.overallScore);
            await this.learnFromSession(this.currentSession, evaluation);

            const sessionId = this.currentSession.id;
            this.currentSession = null;
            this.pdfTextContent = null;
            this.conversationManager.resetContext();
            
            return {
                success: true,
                evaluation: {
                    overallScore: evaluation.overallScore,
                    gradeRecommendation: evaluation.gradeRecommendation,
                    strengths: evaluation.strengths,
                    weaknesses: evaluation.weaknesses,
                    studyRecommendations: evaluation.studyRecommendations
                },
                sessionSummary: conversationSummary
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
            if (!this.agentId) return { message: "Agent not initialized" };
            const { data: sessions } = await this.supabase.from('examination_sessions').select('overall_performance_score, student_satisfaction_score').eq('agent_id', this.agentId).not('overall_performance_score', 'is', null);
            if (!sessions || sessions.length === 0) return { totalSessions: 0, averagePerformance: 0, studentSatisfaction: 0 };
            const avgPerformance = sessions.reduce((sum, s) => sum + (s.overall_performance_score || 0), 0) / sessions.length;
            const avgSatisfaction = sessions.reduce((sum, s) => sum + (s.student_satisfaction_score || 0), 0) / sessions.length;
            return { totalSessions: sessions.length, averagePerformance: Math.round(avgPerformance * 10) / 10, studentSatisfaction: Math.round(avgSatisfaction * 10) / 10, isLearning: this.isLearning };
        } catch (error) {
            console.error('Failed to get performance stats:', error);
            return null;
        }
    }

    // ===== PRIVATE HELPER METHODS (TUTTI PRESENTI) =====
    async loadAgentProfile(agentId) {
        const { data, error } = await this.supabase.from('ai_agent_profiles').select('*').eq('id', agentId).single();
        if (error) throw new Error(`Failed to load agent: ${error.message}`);
        return data;
    }
    async createNewAgentProfile() {
        const defaultProfile = { agent_name: 'Text-Based Tutor AI', version: '2.0', personality_config: { base_type: 'adaptive' } };
        const { data, error } = await this.supabase.from('ai_agent_profiles').insert(defaultProfile).select().single();
        if (error) throw new Error(`Failed to create agent profile: ${error.message}`);
        return data;
    }
    async initializeModules() {
        await Promise.all([ this.examinationEngine.initialize(this.agentProfile), this.questionGenerator.initialize(this.agentProfile), this.personalityManager.initialize(this.agentProfile), this.learningSystem.initialize(this.agentProfile) ]);
    }
    async storeMaterial(file) {
        const materialData = { filename: file.name, file_type: "application/pdf", file_url: file.url, processed_status: 'text_extracted' };
        const { data, error } = await this.supabase.from('uploaded_materials').insert(materialData).select().single();
        if (error) throw new Error(`Failed to store material metadata: ${error.message}`);
        return { ...data, url: file.url };
    }
    async observeInteraction(studentResponse, analysis, professorResponse) {
        if (!this.learningSystem) return;
        await this.learningSystem.recordObservation({
            observation_type: 'interaction_effectiveness',
            observation_data: { student_understanding: analysis.understandingLevel, professor_strategy: professorResponse.strategy, response_type: professorResponse.type },
            success_metrics: { completeness: analysis.completeness, accuracy: analysis.technicalAccuracy },
            context_factors: { session_id: this.currentSession?.id, conversation_phase: this.conversationManager.getCurrentContext().conversationPhase }
        });
    }
    async storeExaminationEvaluation(evaluation) {
        const { error } = await this.supabase.from('exposition_evaluations').insert({ session_id: this.currentSession.id, completeness_score: evaluation.overallScore, technical_accuracy_score: evaluation.overallScore,  logical_flow_score: evaluation.overallScore, conceptual_understanding_score: evaluation.overallScore, overall_assessment: evaluation.feedback, grade_suggested: evaluation.gradeRecommendation });
        if (error) console.error('Failed to store evaluation:', error);
    }
    async updateSessionStatus(status, finalScore = null) {
        const updateData = { session_phase: status, end_time: new Date().toISOString() };
        if (finalScore) updateData.overall_performance_score = finalScore;
        const { error } = await this.supabase.from('examination_sessions').update(updateData).eq('id', this.currentSession.id);
        if (error) console.error('Failed to update session status:', error);
    }
    async learnFromSession(session, evaluation) {
        if (!this.learningSystem) return;
        await this.learningSystem.recordObservation({
            observation_type: 'session_completion',
            observation_data: { final_score: evaluation.overallScore, session_duration: evaluation.totalDuration, personality_used: session.professor_personality_type },
            success_metrics: { student_satisfaction: evaluation.engagementScore || 70 },
            context_factors: { session_id: session.id, total_turns: evaluation.totalTurns }
        });
    }
}

export default PhysicsAgent;