// =========================================================================
// FILE: /api/_lib/agents/PhysicsAgent.js (IL VERO AGENTE - "IL CERVELLO")
// Questo file deve trovarsi nel backend.
// =========================================================================

import { createClient } from '@supabase/supabase-js';
// Assicurati che questi percorsi siano corretti rispetto alla posizione del file
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
            const { error } = await this.supabase
                .from('ai_agent_profiles')
                .insert({ agent_name: 'Continuous Session Agent', version: '5.0' })
                .select();

            if (error && error.code !== '23505') throw error;
            
            console.log('🤖 Agent initialized on server (minimal mode)');
            return { success: true };
        } catch (error) {
            console.error('❌ Server Init failed:', error);
            return { success: true }; // Non bloccare
        }
    }

    async analyzeMaterial(file, progressCallback) {
        try {
            let processedPDF;
            if (file.url) {
                processedPDF = await this.pdfProcessor.processPdfFromUrl(file.url);
            } else if (file.blob) {
                processedPDF = await this.pdfProcessor.processPdfFromBlob(file.blob);
            } else {
                throw new Error("Invalid file input on server");
            }
            this.currentMaterial = this.pdfProcessor.prepareForGemini(processedPDF);
            return { success: true };
        } catch (error) {
            console.error('❌ Material processing failed on server:', error);
            throw error;
        }
    }

    async startExamination() {
        if (!this.currentMaterial) throw new Error("No material loaded on server");
        return await this.conversationManager.startSession(this.currentMaterial);
    }

    async processResponse(responseData) {
        try {
            const text = responseData.text || '';
            const images = responseData.images || [];
            const result = await this.conversationManager.sendMessage(text, images);
            
            return {
                type: result.type,
                response: result.message,
                isComplete: result.isComplete,
                progress: result.progress
            };
        } catch (error) {
            console.error('❌ Process response failed on server:', error);
            return {
                type: 'error',
                response: "An error occurred. Please try again.",
                isComplete: false,
                progress: { covered: 0, total: 1, percentage: 0 }
            };
        }
    }

    async generateFinalEvaluation() {
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