// =========================================================================
// FILE: /api/_lib/agents/PhysicsAgent.js (VERSIONE FINALE DEFINITIVA)
// =========================================================================
import '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { PDFProcessor } from './modules/PDFProcessor.js';
import { ConversationManager } from './modules/ConversationManager.js';

export class PhysicsAgent {
    // MODIFICA 1: Il costruttore accetta anche il materiale esistente
    constructor(supabaseUrl, supabaseKey, existingHistory = [], existingMaterial = null) {
        this.supabase = createClient(supabaseUrl, supabaseKey);
        this.pdfProcessor = new PDFProcessor();
        this.conversationManager = new ConversationManager(existingHistory);
        // Carica il materiale dalla cache
        this.currentMaterial = existingMaterial;
    }

    // MODIFICA 2: Un solo metodo che restituisce l'intero stato della sessione
    getSessionState() {
        return {
            history: this.conversationManager.getHistory(),
            material: this.currentMaterial
        };
    }

    // Il metodo getConversationHistory() non serve più.

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
            // MODIFICA 3: Salva il materiale analizzato nell'istanza corrente
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

    // ... (Tutto il resto del codice da processResponse in poi rimane IDENTICO) ...
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