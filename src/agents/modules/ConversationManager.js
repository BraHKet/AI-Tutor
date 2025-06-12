// ==========================================
// CONVERSATION MANAGER MODULE (SIMPLIFIED)
// ==========================================

export class ConversationManager {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.agentProfile = null;
        
        this.currentContext = {
            sessionId: null,
            currentTopic: null,
            conversationPhase: 'inactive',
            turnHistory: [],
            studentProfile: null,
            professorPersonality: null,
            blocksEncountered: 0,
            hintsGiven: 0,
            startTime: null
        };
    }

    async initialize(agentProfile) {
        this.agentProfile = agentProfile;
        console.log('💬 Conversation Manager initialized (simplified)');
    }

    async startConversation(sessionId, personalityType, topics) {
        try {
            this.currentContext = {
                sessionId,
                currentTopic: topics[0] || null,
                conversationPhase: 'starting',
                turnHistory: [],
                studentProfile: null,
                professorPersonality: personalityType,
                blocksEncountered: 0,
                hintsGiven: 0,
                startTime: new Date(),
                availableTopics: topics,
                currentTopicIndex: 0
            };

            console.log(`💬 Conversation started - Session ${sessionId}`);
            return this.currentContext;
        } catch (error) {
            console.error('Failed to start conversation:', error);
            throw new Error(`Conversation start failed: ${error.message}`);
        }
    }

    async processTurn(speaker, content, metadata = {}) {
        try {
            const turn = {
                turnNumber: this.currentContext.turnHistory.length + 1,
                speaker,
                content,
                timestamp: new Date(),
                phase: this.currentContext.conversationPhase,
                metadata
            };

            this.currentContext.turnHistory.push(turn);
            await this.updateContextFromTurn(turn);
            await this.checkAndUpdatePhase(turn);
            await this.logConversationTurn(turn);

            return {
                success: true,
                currentPhase: this.currentContext.conversationPhase,
                turnNumber: turn.turnNumber,
                contextUpdates: await this.getContextSummary()
            };
        } catch (error) {
            console.error('Failed to process turn:', error);
            throw new Error(`Turn processing failed: ${error.message}`);
        }
    }

    async updateContextFromTurn(turn) {
        if (turn.speaker === 'student') {
            if (this.detectStudentBlock(turn.content)) {
                this.currentContext.blocksEncountered += 1;
            }
        }

        if (turn.speaker === 'professor' && turn.metadata.type === 'hint') {
            this.currentContext.hintsGiven += 1;
        }
    }

    async checkAndUpdatePhase(turn) {
        const currentPhase = this.currentContext.conversationPhase;
        const turnCount = this.currentContext.turnHistory.length;

        if (currentPhase === 'starting' && turnCount >= 2) {
            this.currentContext.conversationPhase = 'exposition';
        } else if (currentPhase === 'exposition' && turnCount >= 15) {
            this.currentContext.conversationPhase = 'evaluation';
        } else if (currentPhase === 'exposition' && this.currentContext.blocksEncountered >= 3) {
            this.currentContext.conversationPhase = 'clarification';
        } else if (currentPhase === 'clarification' && turnCount >= 20) {
            this.currentContext.conversationPhase = 'evaluation';
        }
    }

    async getContextSummary() {
        return {
            sessionId: this.currentContext.sessionId,
            phase: this.currentContext.conversationPhase,
            totalTurns: this.currentContext.turnHistory.length,
            currentTopic: this.currentContext.currentTopic?.topic_name,
            blocksEncountered: this.currentContext.blocksEncountered,
            hintsGiven: this.currentContext.hintsGiven,
            duration: this.getSessionDuration(),
            professorPersonality: this.currentContext.professorPersonality
        };
    }

    getConversationHistory() {
        return this.currentContext.turnHistory;
    }

    getCurrentContext() {
        return { ...this.currentContext };
    }

    async completeConversation() {
        this.currentContext.conversationPhase = 'completed';
        this.currentContext.endTime = new Date();
        
        console.log(`✅ Conversation completed - Session ${this.currentContext.sessionId}`);
        
        return {
            success: true,
            totalDuration: this.getSessionDuration(),
            totalTurns: this.currentContext.turnHistory.length,
            summary: await this.getContextSummary()
        };
    }

    detectStudentBlock(content) {
        const blockIndicators = [
            'non lo so',
            'non ricordo',
            'non capisco',
            'non sono sicuro',
            'ehm',
            'uhm'
        ];

        const lowercaseContent = content.toLowerCase();
        return blockIndicators.some(indicator => lowercaseContent.includes(indicator)) || 
               content.length < 15;
    }

    getSessionDuration() {
        if (this.currentContext.startTime) {
            const endTime = this.currentContext.endTime || new Date();
            return Math.round((endTime - this.currentContext.startTime) / 1000 / 60);
        }
        return 0;
    }

    async logConversationTurn(turn) {
        try {
            const { error } = await this.supabase
                .from('conversation_turns')
                .insert({
                    session_id: this.currentContext.sessionId,
                    turn_number: turn.turnNumber,
                    speaker: turn.speaker,
                    message_content: turn.content,
                    message_type: turn.metadata.type || 'general',
                    concepts_involved: turn.metadata.concepts || [],
                    ai_analysis: turn.metadata.analysis || {},
                    student_emotional_state: turn.metadata.emotionalState,
                    professor_strategy_used: turn.metadata.strategy,
                    effectiveness_score: turn.metadata.effectiveness
                });

            if (error) {
                console.error('Failed to log turn:', error);
            }
        } catch (error) {
            console.error('Error logging conversation turn:', error);
        }
    }

    resetContext() {
        this.currentContext = {
            sessionId: null,
            currentTopic: null,
            conversationPhase: 'inactive',
            turnHistory: [],
            studentProfile: null,
            professorPersonality: null,
            blocksEncountered: 0,
            hintsGiven: 0,
            startTime: null
        };
    }

    getConversationStats() {
        return {
            totalTurns: this.currentContext.turnHistory.length,
            studentTurns: this.currentContext.turnHistory.filter(t => t.speaker === 'student').length,
            professorTurns: this.currentContext.turnHistory.filter(t => t.speaker === 'professor').length,
            blocksEncountered: this.currentContext.blocksEncountered,
            hintsGiven: this.currentContext.hintsGiven,
            currentPhase: this.currentContext.conversationPhase,
            duration: this.getSessionDuration()
        };
    }

    isConversationActive() {
        return this.currentContext.conversationPhase !== 'inactive' && 
               this.currentContext.conversationPhase !== 'completed';
    }

    getLastStudentResponse() {
        const studentTurns = this.currentContext.turnHistory.filter(t => t.speaker === 'student');
        return studentTurns[studentTurns.length - 1];
    }

    getLastProfessorResponse() {
        const professorTurns = this.currentContext.turnHistory.filter(t => t.speaker === 'professor');
        return professorTurns[professorTurns.length - 1];
    }
}

export default ConversationManager;