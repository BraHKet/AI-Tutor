// src/utils/gemini/modules/distributionModule.js - DISTRIBUZIONE SEMPLIFICATA CON DIFFICOLTÀ E ORE

import { executeAIRequest, createAIServiceInput, validateAIServiceOutput } from '../services/geminiAIService.js';
import { 
  createDistributionPhaseInput, 
  createDistributionPhaseOutput, 
  validatePhaseInput,
  logPhase,
  createPhaseError,
  executePhaseWithErrorHandling
} from '../shared/geminiShared.js';

// ===== CONFIGURAZIONE SEMPLIFICATA =====
const MODULE_CONFIG = {
  MAX_HOURS_PER_DAY: 8,
  MIN_HOURS_PER_DAY: 2,
  DIFFICULTY_WEIGHTS: {
    beginner: 0.8,
    intermediate: 1.0,
    advanced: 1.3
  }
};

// ===== DISTRIBUZIONE INTELLIGENTE CON DIFFICOLTÀ E ORE =====

async function phaseSmartDistribution(input) {
  const { examName, topics, totalDays, userDescription, progressCallback } = input;
  
  logPhase('smart-distribution', `Distribuzione ${topics.length} argomenti in ${totalDays} giorni`);
  
  // Prepara info concise degli argomenti
  const topicsInfo = topics.map((topic, index) => {
    const hours = topic.estimatedHours || 3;
    const difficulty = topic.difficulty || 'intermediate';
    const pages = topic.totalPages || 0;
    
    return `${index + 1}. "${topic.title}" - ${hours}h, ${difficulty}, ${pages}p`;
  }).join('\n');

  const totalHours = topics.reduce((sum, t) => sum + (t.estimatedHours || 3), 0);
  const avgHoursPerDay = Math.round(totalHours / totalDays);

  const prompt = `Distribuisci ${topics.length} argomenti in ${totalDays} giorni per l'esame "${examName}".

ARGOMENTI (ore-difficoltà-pagine):
${topicsInfo}

VINCOLI:
- Ore totali: ${totalHours}h (media ${avgHoursPerDay}h/giorno)
- Max 8h/giorno, Min 2h/giorno
- Argomenti "advanced" richiedono più tempo/attenzione
- Distribuisci il carico in modo bilanciato

${userDescription ? `PREFERENZE: ${userDescription}` : ''}

JSON COMPATTO:
{
  "dailyPlan": [
    {
      "day": 1,
      "topics": ["Titolo esatto argomento"],
      "totalHours": 6,
      "difficulty": "mixed",
      "strategy": "Focus su basi"
    }
  ],
  "stats": {
    "totalTopicsAssigned": 0,
    "avgHoursPerDay": 0,
    "balanced": true
  }
}

REGOLE:
- Ogni argomento assegnato ESATTAMENTE una volta
- Titoli ESATTI dalla lista
- Giorni advanced prima quando possibile
- Bilanciamento ore/difficoltà per giorno`;

  const aiInput = createAIServiceInput(prompt, [], 'text', 'smart-distribution', progressCallback);
  const result = await executeAIRequest(aiInput);
  
  validateAIServiceOutput(result, ['dailyPlan']);
  return result.data;
}

// ===== VALIDAZIONE E CORREZIONE =====

async function phaseValidateAndFix(input) {
  const { distributionResult, totalDays, originalTopics, progressCallback } = input;
  
  logPhase('validate-fix', 'Validazione e correzione distribuzione');
  
  const dailyPlan = distributionResult.dailyPlan || [];
  const originalTitles = new Set(originalTopics.map(t => t.title?.trim()));
  const topicsMap = new Map(originalTopics.map(t => [t.title?.trim(), t]));
  
  // Trova argomenti assegnati e non assegnati
  const assignedTopics = new Set();
  dailyPlan.forEach(day => {
    (day.topics || []).forEach(title => {
      if (originalTitles.has(title)) {
        assignedTopics.add(title);
      }
    });
  });
  
  const unassigned = Array.from(originalTitles).filter(title => !assignedTopics.has(title));
  
  // Correggi distribuzione
  const correctedPlan = [];
  
  // Assicura tutti i giorni 1-totalDays
  for (let day = 1; day <= totalDays; day++) {
    const existingDay = dailyPlan.find(d => d.day === day);
    
    const validTopics = (existingDay?.topics || [])
      .filter(title => originalTitles.has(title))
      .map(title => {
        const topic = topicsMap.get(title);
        return {
          title: title,
          hours: topic?.estimatedHours || 3,
          difficulty: topic?.difficulty || 'intermediate',
          pages: topic?.totalPages || 0
        };
      });
    
    const dayHours = validTopics.reduce((sum, t) => sum + t.hours, 0);
    const avgDifficulty = calculateAvgDifficulty(validTopics);
    
    correctedPlan.push({
      day: day,
      assignedTopics: validTopics.map(t => ({
        title: t.title,
        estimatedHours: t.hours,
        priority: getDifficultyPriority(t.difficulty),
        studyFocus: `Studio ${t.difficulty}: ${t.title}`,
        originalData: topicsMap.get(t.title)
      })),
      dailyWorkload: {
        totalTopics: validTopics.length,
        totalHours: dayHours,
        totalPages: validTopics.reduce((sum, t) => sum + t.pages, 0),
        difficultyLevel: avgDifficulty,
        feasible: dayHours <= MODULE_CONFIG.MAX_HOURS_PER_DAY
      },
      dayType: determineDayType(validTopics, dayHours),
      studyTips: generateStudyTips(validTopics, dayHours)
    });
  }
  
  // Redistribuisci argomenti non assegnati
  for (const title of unassigned) {
    const topic = topicsMap.get(title);
    const hours = topic?.estimatedHours || 3;
    
    // Trova giorno con spazio disponibile
    const availableDay = correctedPlan.find(day => {
      const currentHours = day.dailyWorkload.totalHours;
      return currentHours + hours <= MODULE_CONFIG.MAX_HOURS_PER_DAY;
    });
    
    if (availableDay) {
      availableDay.assignedTopics.push({
        title: title,
        estimatedHours: hours,
        priority: getDifficultyPriority(topic?.difficulty),
        studyFocus: `Studio ${topic?.difficulty || 'standard'}: ${title}`,
        originalData: topic
      });
      
      // Ricalcola workload
      const newTopics = availableDay.assignedTopics.map(t => ({
        hours: t.estimatedHours,
        difficulty: t.originalData?.difficulty || 'intermediate',
        pages: t.originalData?.totalPages || 0
      }));
      
      availableDay.dailyWorkload = {
        totalTopics: newTopics.length,
        totalHours: newTopics.reduce((sum, t) => sum + t.hours, 0),
        totalPages: newTopics.reduce((sum, t) => sum + t.pages, 0),
        difficultyLevel: calculateAvgDifficulty(newTopics),
        feasible: availableDay.dailyWorkload.totalHours <= MODULE_CONFIG.MAX_HOURS_PER_DAY
      };
      
      availableDay.studyTips = generateStudyTips(newTopics, availableDay.dailyWorkload.totalHours);
    }
  }
  
  // Calcola statistiche finali
  const stats = calculateStats(correctedPlan, originalTopics);
  
  return {
    dailyPlan: correctedPlan,
    statistics: stats,
    corrections: {
      unassignedFound: unassigned.length,
      redistributed: unassigned.length > 0
    }
  };
}

// ===== FUNZIONI DI SUPPORTO =====

function calculateAvgDifficulty(topics) {
  if (topics.length === 0) return 'light';
  
  const scores = { beginner: 1, intermediate: 2, advanced: 3 };
  const avg = topics.reduce((sum, t) => sum + (scores[t.difficulty] || 2), 0) / topics.length;
  
  if (avg <= 1.3) return 'beginner';
  if (avg >= 2.7) return 'advanced';
  return 'intermediate';
}

function getDifficultyPriority(difficulty) {
  const map = { beginner: 'low', intermediate: 'medium', advanced: 'high' };
  return map[difficulty] || 'medium';
}

function determineDayType(topics, hours) {
  if (topics.length === 0) return 'review';
  if (hours > 6) return 'intensive';
  if (topics.some(t => t.difficulty === 'advanced')) return 'challenging';
  return 'standard';
}

function generateStudyTips(topics, hours) {
  if (topics.length === 0) return 'Giorno di ripasso';
  
  const tips = [];
  if (hours > 6) tips.push('Giorno intensivo: fai pause ogni 90 min');
  if (topics.some(t => t.difficulty === 'advanced')) tips.push('Inizia con argomenti complessi');
  if (topics.length > 1) tips.push('Alterna tra argomenti diversi');
  
  return tips.length > 0 ? tips.join('. ') : 'Studio costante e metodico';
}

function calculateStats(dailyPlan, originalTopics) {
  const totalAssigned = dailyPlan.reduce((sum, day) => sum + day.assignedTopics.length, 0);
  const effectiveDays = dailyPlan.filter(day => day.assignedTopics.length > 0).length;
  const totalHours = dailyPlan.reduce((sum, day) => sum + day.dailyWorkload.totalHours, 0);
  
  return {
    totalDaysPlanned: dailyPlan.length,
    effectiveDays: effectiveDays,
    totalTopicsDistributed: totalAssigned,
    distributionCoverage: originalTopics.length > 0 ? totalAssigned / originalTopics.length : 1,
    workloadStats: {
      totalHours: totalHours,
      avgHoursPerDay: Math.round((totalHours / effectiveDays) * 10) / 10,
      avgTopicsPerDay: Math.round((totalAssigned / effectiveDays) * 10) / 10
    },
    qualityMetrics: {
      overallScore: Math.min(1.0, totalAssigned / originalTopics.length),
      balanceScore: calculateBalanceScore(dailyPlan),
      feasibilityScore: calculateFeasibilityScore(dailyPlan)
    }
  };
}

function calculateBalanceScore(dailyPlan) {
  const hours = dailyPlan.map(d => d.dailyWorkload.totalHours).filter(h => h > 0);
  if (hours.length === 0) return 1.0;
  
  const avg = hours.reduce((sum, h) => sum + h, 0) / hours.length;
  const variance = hours.reduce((sum, h) => sum + Math.pow(h - avg, 2), 0) / hours.length;
  
  return Math.max(0, 1 - Math.sqrt(variance) / avg);
}

function calculateFeasibilityScore(dailyPlan) {
  const activeDays = dailyPlan.filter(d => d.assignedTopics.length > 0);
  const feasibleDays = activeDays.filter(d => d.dailyWorkload.feasible);
  
  return activeDays.length > 0 ? feasibleDays.length / activeDays.length : 1.0;
}

// ===== ORCHESTRATORE DISTRIBUZIONE =====

export async function distributeTopics(input) {
  const { examName, topics, totalDays, userDescription = '', progressCallback } = input;
  
  validatePhaseInput('distribution', examName, topics);
  
  if (!totalDays || totalDays < 1) {
    throw createPhaseError('distribution', 'totalDays deve essere >= 1');
  }
  
  logPhase('distribution', `DISTRIBUZIONE INTELLIGENTE: ${topics.length} argomenti, ${totalDays} giorni`);
  
  try {
    // FASE 1: Distribuzione smart con AI
    progressCallback?.({ type: 'processing', message: 'Distribuzione intelligente argomenti...' });
    
    const distributionResult = await executePhaseWithErrorHandling(
      'smart-distribution',
      phaseSmartDistribution,
      { examName, topics, totalDays, userDescription, progressCallback }
    );
    
    // FASE 2: Validazione e correzione
    progressCallback?.({ type: 'processing', message: 'Validazione e bilanciamento...' });
    
    const finalResult = await executePhaseWithErrorHandling(
      'validate-fix',
      phaseValidateAndFix,
      { distributionResult, totalDays, originalTopics: topics, progressCallback }
    );
    
    const output = createDistributionPhaseOutput('distribution', {
      dailyPlan: finalResult.dailyPlan,
      statistics: finalResult.statistics
    }, {
      totalTopics: topics.length,
      totalDays: totalDays,
      qualityScore: finalResult.statistics.qualityMetrics.overallScore,
      corrections: finalResult.corrections.redistributed
    });

    logPhase('distribution', `COMPLETATA: ${output.data.statistics.totalTopicsDistributed}/${topics.length} argomenti distribuiti`);
    
    return output;

  } catch (error) {
    logPhase('distribution', `ERRORE: ${error.message}`);
    throw createPhaseError('distribution', `Errore distribuzione: ${error.message}`, error);
  }
}

export default {
  distributeTopics,
  MODULE_CONFIG
};