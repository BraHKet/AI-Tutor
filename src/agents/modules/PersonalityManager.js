// ==========================================
// FILE: src/agents/modules/PersonalityManager.js (VERSIONE CORRETTA DEFINITIVA)
// ==========================================

export class PersonalityManager {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.agentProfile = null;
        
        this.personalities = {
            strict: {
                name: 'Severo',
                description: "Diretto, formale e si aspetta precisione. Non fa molti complimenti e va dritto al punto degli errori.",
                characteristics: { patience: 0.3, encouragement: 0.2, directness: 0.9 }
            },
            kind: {
                name: 'Gentile',
                description: "Incoraggiante, paziente e di supporto. Cerca di mettere lo studente a proprio agio e lo aiuta a superare le difficoltà.",
                characteristics: { patience: 0.9, encouragement: 0.9, directness: 0.4 }
            },
            sarcastic: {
                name: 'Sarcastico',
                description: "Arguto, ironico e a volte pungente. Usa l'umorismo per testare la sicurezza dello studente. Non è mai offensivo, ma stimolante.",
                characteristics: { patience: 0.5, encouragement: 0.4, directness: 0.7 }
            },
            patient: {
                name: 'Paziente',
                description: "Calmo, metodico e disposto a dare allo studente tutto il tempo necessario. Guida l'esposizione passo dopo passo senza mettere fretta.",
                characteristics: { patience: 1.0, encouragement: 0.8, directness: 0.6 }
            },
            adaptive: {
                name: 'Adattivo',
                description: "Un professore equilibrato. Inizia in modo neutrale e adatta il suo stile in base alla performance e allo stato emotivo dello studente.",
                characteristics: { patience: 0.7, encouragement: 0.7, directness: 0.6 }
            }
        };
    }

    async initialize(agentProfile) {
        this.agentProfile = agentProfile;
        console.log('🎭 Personality Manager initialized (simplified)');
    }

    // =======================================================
    // ===== MODIFICA CHIAVE PER RISOLVERE L'ERRORE ==========
    // =======================================================
    async selectOptimalPersonality(studentProfile, topics, preferredPersonality = null) {
        try {
            let personalityKey = 'adaptive'; // Usiamo sempre la chiave inglese (es. 'adaptive') come ID.

            if (preferredPersonality && this.personalities[preferredPersonality]) {
                personalityKey = preferredPersonality;
            } else {
                const studentCharacteristics = studentProfile?.detected_characteristics || {};
                if (studentCharacteristics.needs_encouragement) personalityKey = 'kind';
                if (studentCharacteristics.confident) personalityKey = 'strict';
            }
            
            // Restituiamo l'intero oggetto personalità, ma aggiungiamo anche la sua chiave per riferimento.
            return {
                key: personalityKey, 
                ...this.personalities[personalityKey]
            };

        } catch (error) {
            console.error('Failed to select personality:', error);
            // Fallback sicuro che include la chiave
            return { key: 'adaptive', ...this.personalities['adaptive'] };
        }
    }
    // =======================================================
    // ================= FINE DELLA MODIFICA ==================
    // =======================================================

    async updateEffectiveness(insights) {
        try {
            const personalityInsights = insights.filter(insight => 
                insight.insight_type === 'personality_effectiveness'
            );
            console.log(`🎭 Updated personality effectiveness based on ${personalityInsights.length} insights`);
        } catch (error) {
            console.error('Failed to update personality effectiveness:', error);
        }
    }

    async getPersonalityStats() {
        try {
            const { data: sessions } = await this.supabase
                .from('examination_sessions')
                .select('professor_personality_type, overall_performance_score, student_satisfaction_score')
                .eq('agent_id', this.agentProfile?.id)
                .not('overall_performance_score', 'is', null);

            if (!sessions || sessions.length === 0) {
                return { message: 'No personality data available yet' };
            }

            const personalityStats = {};
            sessions.forEach(session => {
                const personality = session.professor_personality_type || 'unknown';
                if (!personalityStats[personality]) {
                    personalityStats[personality] = {
                        count: 0,
                        totalPerformance: 0,
                        totalSatisfaction: 0,
                        avgPerformance: 0,
                        avgSatisfaction: 0
                    };
                }
                
                personalityStats[personality].count += 1;
                personalityStats[personality].totalPerformance += session.overall_performance_score || 0;
                personalityStats[personality].totalSatisfaction += session.student_satisfaction_score || 0;
            });

            Object.keys(personalityStats).forEach(personality => {
                const stats = personalityStats[personality];
                if (stats.count > 0) {
                    stats.avgPerformance = stats.totalPerformance / stats.count;
                    stats.avgSatisfaction = stats.totalSatisfaction / stats.count;
                }
            });

            return personalityStats;
        } catch (error) {
            console.error('Failed to get personality stats:', error);
            return null;
        }
    }
    
    getAvailablePersonalities() {
        return Object.keys(this.personalities);
    }
}

export default PersonalityManager;