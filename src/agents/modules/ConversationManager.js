// ==========================================
// FILE: src/agents/modules/ConversationManager.js (VERSIONE COMPLETA E ROBUSTA)
// ==========================================

export class ConversationManager {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.agentProfile = null;
        
        // Lo stato ora è un oggetto, per evitare che venga sovrascritto.
        this.currentContext = {
            sessionId: null,
            currentTopic: null,
            conversationPhase: 'inactive',
            turnHistory: [],
            studentProfile: null,
            professorPersonality: null, // Memorizzeremo la CHIAVE della personalità qui
            availableTopics: [],
            startTime: null
        };
    }

    async initialize(agentProfile) {
        this.agentProfile = agentProfile;
        console.log('💬 Conversation Manager initialized (simplified)');
    }

    // `personalityKey` è la chiave inglese, es. "adaptive"
    async startConversation(sessionId, personalityKey, topics) {
        this.resetContext(); // Assicura che partiamo da uno stato pulito
        
        this.currentContext.sessionId = sessionId;
        this.currentContext.professorPersonality = personalityKey; // Memorizza la chiave
        this.currentContext.availableTopics = topics;
        this.currentContext.currentTopic = topics[0] || null; // Anche se non lo usiamo molto, lo teniamo
        this.currentContext.conversationPhase = 'starting';
        this.currentContext.startTime = new Date();

        console.log(`💬 Conversation started - Session ${sessionId} with personality key: ${personalityKey}`);
        return this.currentContext;
    }

    async processTurn(speaker, content, metadata = {}) {
        if (!this.currentContext.sessionId) {
            console.error("Cannot process turn: No active session.");
            return;
        }

        const turn = {
            turnNumber: this.currentContext.turnHistory.length + 1,
            speaker,
            content,
            timestamp: new Date(),
            metadata
        };

        this.currentContext.turnHistory.push(turn);
        
        // Non c'è bisogno di altre logiche complesse qui per ora
        // await this.logConversationTurn(turn); // Puoi decommentarlo se la tabella 'conversation_turns' è pronta

        return {
            success: true,
            turnNumber: turn.turnNumber,
        };
    }

    // Questo metodo è la fonte di verità per il contesto
    getCurrentContext() {
        // Restituisce una copia dell'oggetto per evitare modifiche accidentali
        return { ...this.currentContext };
    }

    async completeConversation() {
        this.currentContext.conversationPhase = 'completed';
        const endTime = new Date();
        const duration = this.currentContext.startTime ? Math.round((endTime - this.currentContext.startTime) / 1000 / 60) : 0;
        
        console.log(`✅ Conversation completed - Session ${this.currentContext.sessionId}`);
        
        const summary = this.getContextSummary();
        summary.totalDuration = duration;
        
        return summary;
    }
    
    getContextSummary() {
        return {
            sessionId: this.currentContext.sessionId,
            phase: this.currentContext.conversationPhase,
            totalTurns: this.currentContext.turnHistory.length,
            professorPersonality: this.currentContext.professorPersonality
        };
    }

    getConversationHistory() {
        return [...this.currentContext.turnHistory];
    }

    resetContext() {
        this.currentContext = {
            sessionId: null,
            currentTopic: null,
            conversationPhase: 'inactive',
            turnHistory: [],
            studentProfile: null,
            professorPersonality: null,
            availableTopics: [],
            startTime: null
        };
        console.log("💬 Conversation context has been reset.");
    }
}

export default ConversationManager;