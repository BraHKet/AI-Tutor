// ==========================================
// FILE: src/agents/PhysicsAgent.js (ULTRA-MINIMAL CON SESSIONE CONTINUA)
// ==========================================

import { createClient } from '@supabase/supabase-js';
import { PDFProcessor } from './modules/PDFProcessor.js';
import { ConversationManager } from './modules/ConversationManager.js';

export class PhysicsAgent {
    constructor(supabaseUrl, supabaseKey) {
        this.supabase = createClient(supabaseUrl, supabaseKey);
        this.pdfProcessor = new PDFProcessor();
        this.conversationManager = new ConversationManager();
        this.currentMaterial = null;
    }

    async initialize() {
        try {
            // Minimal DB setup - solo per compatibilità
            const { error } = await this.supabase
                .from('ai_agent_profiles')
                .insert({ agent_name: 'Continuous Session Agent', version: '5.0' })
                .select();

            if (error && error.code !== '23505') throw error;
            
            console.log('🤖 Agent initialized (minimal mode)');
            return { success: true };
        } catch (error) {
            console.error('❌ Init failed:', error);
            // Non bloccare se il database fallisce
            return { success: true };
        }
    }

    async analyzeMaterial(file, progressCallback) {
        try {
            progressCallback?.({ message: 'Converting PDF to Base64...' });
            
            // Processa PDF una sola volta
            let processedPDF;
            if (file.url) {
                processedPDF = await this.pdfProcessor.processPdfFromUrl(file.url);
            } else if (file.blob) {
                processedPDF = await this.pdfProcessor.processPdfFromBlob(file.blob);
            } else {
                throw new Error("Invalid file");
            }

            // Prepara per sessione Gemini
            this.currentMaterial = this.pdfProcessor.prepareForGemini(processedPDF);
            return { success: true };
        } catch (error) {
            console.error('❌ Material failed:', error);
            throw error;
        }
    }

    async startExamination() {
        if (!this.currentMaterial) throw new Error("No material");
        return await this.conversationManager.startSession(this.currentMaterial);
    }

    async processResponse(responseData) {
        try {
            const text = typeof responseData === 'string' ? responseData : responseData.text;
            const image = typeof responseData === 'object' ? responseData.image : null;
            
            const result = await this.conversationManager.sendMessage(text, image);
            
            return {
                type: result.type,
                response: result.message,
                isComplete: result.isComplete,
                progress: result.progress
            };
        } catch (error) {
            console.error('❌ Process failed:', error);
            return {
                type: 'error',
                response: "Errore. Riprovare?",
                isComplete: false,
                progress: { covered: 0, total: 1, percentage: 0 }
            };
        }
    }

    async generateFinalEvaluation() {
        // Minimal fallback
        return {
            finalGrade: "24/30",
            gradeDescription: "Buono", 
            overallScore: 75,
            strengths: ["Partecipazione"],
            improvements: ["Approfondimento"],
            finalComment: "Buona preparazione."
        };
    }

    reset() {
        this.currentMaterial = null;
        this.conversationManager.endSession();
    }
}

export default PhysicsAgent;