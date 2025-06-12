// ==========================================
// LEARNING SYSTEM MODULE (SIMPLIFIED)
// ==========================================

export class LearningSystem {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.agentProfile = null;
        this.learningRate = 0.1;
        this.confidenceThreshold = 0.8;
        this.minSampleSize = 5;
        
        this.learningAreas = {
            questionEffectiveness: 'How effective are different question types',
            studentPatterns: 'Common student behavior patterns',
            personalityImpact: 'How personality affects student performance'
        };
    }

    async initialize(agentProfile) {
        this.agentProfile = agentProfile;
        this.learningRate = agentProfile.learning_config?.learning_rate || 0.1;
        console.log('🧠 Learning System initialized (simplified)');
    }

    async recordObservation(observation) {
        try {
            const { error } = await this.supabase
                .from('agent_observations')
                .insert({
                    agent_id: this.agentProfile.id,
                    ...observation,
                    timestamp: new Date().toISOString()
                });

            if (error) {
                console.error('Failed to record observation:', error);
                return false;
            }

            console.log('📝 Observation recorded:', observation.observation_type);
            return true;
        } catch (error) {
            console.error('Error recording observation:', error);
            return false;
        }
    }

    async extractInsights(recentSessions) {
        const insights = [];

        try {
            if (recentSessions.length >= this.minSampleSize) {
                const avgPerformance = recentSessions.reduce((sum, s) => 
                    sum + (s.overall_performance_score || 0), 0
                ) / recentSessions.length;

                const avgSatisfaction = recentSessions.reduce((sum, s) => 
                    sum + (s.student_satisfaction_score || 0), 0
                ) / recentSessions.length;

                insights.push({
                    insight_type: 'performance_trend',
                    insight_description: `Agent achieving ${avgPerformance.toFixed(1)}% average performance`,
                    insight_data: {
                        avg_performance: avgPerformance,
                        avg_satisfaction: avgSatisfaction,
                        session_count: recentSessions.length
                    },
                    confidence_level: Math.min(0.9, recentSessions.length / 20),
                    supporting_evidence: {
                        sample_size: recentSessions.length,
                        trend: avgPerformance > 70 ? 'positive' : 'needs_improvement'
                    }
                });
            }

            console.log(`💡 Extracted ${insights.length} learning insights`);
            return insights;
        } catch (error) {
            console.error('Failed to extract insights:', error);
            return [];
        }
    }

    async updateStrategies(insights) {
        const improvements = [];

        try {
            for (const insight of insights) {
                if (insight.confidence_level >= this.confidenceThreshold) {
                    const improvement = await this.implementSimpleImprovement(insight);
                    if (improvement) {
                        improvements.push(improvement);
                    }
                }
            }

            console.log(`🔄 Implemented ${improvements.length} strategy improvements`);
            return improvements;
        } catch (error) {
            console.error('Failed to update strategies:', error);
            return [];
        }
    }

    async implementSimpleImprovement(insight) {
        try {
            const improvementData = {
                agent_id: this.agentProfile.id,
                strategy_name: `${insight.insight_type}_${Date.now()}`,
                strategy_description: insight.insight_description,
                strategy_config: insight.insight_data,
                context_conditions: { insight_type: insight.insight_type },
                success_rate: 0.0,
                sample_size: 0
            };

            const { data, error } = await this.supabase
                .from('strategy_effectiveness')
                .insert(improvementData)
                .select()
                .single();

            if (error) {
                console.error('Failed to store improvement:', error);
                return null;
            }

            await this.supabase
                .from('agent_learning_insights')
                .insert({
                    agent_id: this.agentProfile.id,
                    insight_type: insight.insight_type,
                    insight_description: insight.insight_description,
                    insight_data: insight.insight_data,
                    confidence_level: insight.confidence_level,
                    supporting_evidence: insight.supporting_evidence,
                    current_status: 'active'
                });

            return {
                id: data.id,
                type: insight.insight_type,
                description: insight.insight_description,
                expectedImpact: this.estimateImpact(insight),
                confidence: insight.confidence_level
            };
        } catch (error) {
            console.error('Failed to implement improvement:', error);
            return null;
        }
    }

    async performSimpleLearningCycle() {
        try {
            console.log('🔄 Starting simple learning cycle...');

            const { data: recentSessions } = await this.supabase
                .from('examination_sessions')
                .select('*')
                .eq('agent_id', this.agentProfile.id)
                .gte('start_time', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
                .order('start_time', { ascending: false })
                .limit(20);

            if (recentSessions && recentSessions.length >= 3) {
                const insights = await this.extractInsights(recentSessions);
                const improvements = await this.updateStrategies(insights);

                console.log(`📈 Learning cycle completed: ${improvements.length} improvements made`);
                
                return {
                    success: true,
                    insightsGenerated: insights.length,
                    improvementsMade: improvements.length,
                    performanceImpact: improvements.reduce((sum, imp) => sum + imp.expectedImpact, 0)
                };
            } else {
                console.log('📊 Not enough data for learning cycle');
                return { success: true, message: 'Insufficient data for learning' };
            }
        } catch (error) {
            console.error('Learning cycle failed:', error);
            throw new Error(`Learning failed: ${error.message}`);
        }
    }

    async getLearningStats() {
        try {
            const { data: observations } = await this.supabase
                .from('agent_observations')
                .select('count')
                .eq('agent_id', this.agentProfile.id);

            const { data: insights } = await this.supabase
                .from('agent_learning_insights')
                .select('count')
                .eq('agent_id', this.agentProfile.id)
                .eq('current_status', 'active');

            const { data: strategies } = await this.supabase
                .from('strategy_effectiveness')
                .select('count')
                .eq('agent_id', this.agentProfile.id)
                .eq('active', true);

            return {
                totalObservations: observations?.[0]?.count || 0,
                activeInsights: insights?.[0]?.count || 0,
                activeStrategies: strategies?.[0]?.count || 0,
                learningEnabled: true
            };
        } catch (error) {
            console.error('Failed to get learning stats:', error);
            return null;
        }
    }

    estimateImpact(insight) {
        const baseImpact = insight.confidence_level * 10;
        return Math.round(baseImpact);
    }

    async extractQuickInsights(observations) {
        const insights = [];

        try {
            const patternCounts = {};
            observations.forEach(obs => {
                const pattern = obs.observation_type;
                patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
            });

            Object.entries(patternCounts).forEach(([pattern, count]) => {
                if (count >= 2) {
                    insights.push({
                        insight_type: 'frequent_pattern',
                        insight_description: `Frequent pattern: ${pattern}`,
                        insight_data: { pattern, frequency: count },
                        confidence_level: 0.6,
                        supporting_evidence: { observation_count: count }
                    });
                }
            });

            return insights;
        } catch (error) {
            console.error('Failed to extract quick insights:', error);
            return [];
        }
    }
}

export default LearningSystem;