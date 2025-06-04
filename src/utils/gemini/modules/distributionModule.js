// src/utils/gemini/modules/distributionModule.js - MODULO DISTRIBUZIONE COMPLETAMENTE INDIPENDENTE

import { executeAIRequest, createAIServiceInput, validateAIServiceOutput } from '../services/geminiAIService.js';
import { 
  createDistributionPhaseInput, 
  createDistributionPhaseOutput, 
  validatePhaseInput,
  logPhase,
  createPhaseError,
  executePhaseWithErrorHandling
} from '../shared/geminiShared.js';

// ===== CONFIGURAZIONE MODULO =====
const MODULE_CONFIG = {
  MAX_TOPICS_PER_DAY: 3,
  RESERVE_REVIEW_DAYS: true
};

// ===== INPUT/OUTPUT INTERFACES =====

/**
 * @typedef {Object} DistributionInput
 * @property {string} examName - Nome dell'esame
 * @property {Array} topics - Lista degli argomenti da distribuire
 * @property {number} totalDays - Numero totale di giorni
 * @property {string} userDescription - Descrizione utente (opzionale)
 * @property {function} progressCallback - Callback per progress (opzionale)
 */

/**
 * @typedef {Object} DistributionOutput
 * @property {Array} dailyPlan - Piano giornaliero
 * @property {Object} statistics - Statistiche della distribuzione
 * @property {Object} phaseResults - Risultati delle singole fasi
 * @property {boolean} success - Successo dell'operazione
 */

// ===== FASI DI DISTRIBUZIONE =====

/**
 * FASE 1: Distribuzione Equa degli Argomenti
 * INPUT: examName, topics, totalDays, userDescription
 * OUTPUT: Distribuzione giornaliera degli argomenti
 */
async function phaseEquitableDistribution(input) {
  const { examName, topics, totalDays, userDescription, progressCallback } = input;
  
  logPhase('equitable-distribution', `${topics.length} argomenti in ${totalDays} giorni`);
  
  const topicsInfo = topics.map((topic, index) => {
    let info = `${index + 1}. ${topic.title}`;
    if (topic.description) {
      info += ` - ${topic.description.substring(0, 100)}`;
    }
    if (topic.totalPages || (topic.pages_info?.length > 0)) {
      const totalPages = topic.totalPages || topic.pages_info?.reduce((sum, p) => sum + (p.end_page - p.start_page + 1), 0) || 0;
      info += ` [${totalPages} pagine]`;
    }
    if (topic.priority) {
      info += ` (Priorità: ${topic.priority})`;
    }
    if (topic.difficulty) {
      info += ` (Difficoltà: ${topic.difficulty})`;
    }
    return info;
  }).join('\n');

  const prompt = `DISTRIBUZIONE EQUA DEGLI ARGOMENTI per l'esame "${examName}" (${totalDays} giorni):

ARGOMENTI DA DISTRIBUIRE:
${topicsInfo}

${userDescription ? `Note utente: "${userDescription}"` : ''}

OBIETTIVO: Distribuire equamente gli argomenti nei ${totalDays} giorni disponibili.

REGOLE CRITICHE:
1. Ogni argomento deve essere assegnato UNA SOLA VOLTA
2. Distribuire in modo bilanciato considerando:
   - Numero di pagine per argomento
   - Priorità e difficoltà
   - Carico di lavoro giornaliero equilibrato
3. Massimo ${MODULE_CONFIG.MAX_TOPICS_PER_DAY} argomenti per giorno
4. Se necessario, lasciare alcuni giorni vuoti per ripasso
5. Priorità agli argomenti più importanti nei primi giorni

FORMATO RICHIESTO - Specifica esattamente tutti i ${totalDays} giorni:

JSON richiesto:
{
  "dailyDistribution": [
    {
      "day": 1,
      "assignedTopics": [
        {
          "title": "Nome esatto argomento come da lista",
          "description": "Descrizione studio per questo giorno",
          "estimatedHours": 3,
          "priority": "high"
        }
      ],
      "dailyWorkload": {
        "totalTopics": 1,
        "totalPages": 15,
        "estimatedHours": 3,
        "difficulty": "medium"
      },
      "dayType": "study"
    }
  ],
  "distributionSummary": {
    "totalDaysUsed": ${totalDays},
    "totalTopicsDistributed": ${topics.length},
    "studyDays": 6,
    "reviewDays": 1,
    "averageTopicsPerDay": 1.2,
    "averageHoursPerDay": 3.5
  },
  "unassignedTopics": [],
  "notes": "Strategia di distribuzione utilizzata"
}

IMPORTANTE: 
- Assicurati che la somma di assignedTopics di tutti i giorni sia esattamente ${topics.length}
- Ogni titolo deve corrispondere ESATTAMENTE a uno degli argomenti nella lista
- Tutti i ${totalDays} giorni devono essere specificati (anche se vuoti per ripasso)`;

  const aiInput = createAIServiceInput(prompt, [], 'text', 'equitable-distribution', progressCallback);
  const result = await executeAIRequest(aiInput);
  
  validateAIServiceOutput(result, ['dailyDistribution']);
  
  logPhase('equitable-distribution', `Distribuzione: ${result.data.dailyDistribution?.length || 0} giorni pianificati`);
  return result.data;
}

/**
 * FASE 2: Validazione e Correzione
 * INPUT: distributionResult, totalDays, originalTopics
 * OUTPUT: Distribuzione validata e corretta
 */
async function phaseDistributionValidation(input) {
  const { distributionResult, totalDays, originalTopics, progressCallback } = input;
  
  logPhase('distribution-validation', `Validazione distribuzione: ${totalDays} giorni target, ${originalTopics.length} argomenti`);
  
  progressCallback?.({ type: 'processing', message: 'Validazione e correzione distribuzione...' });

  const dailyPlan = distributionResult.dailyDistribution || [];
  
  // Crea mappa degli argomenti originali per controllo
  const originalTopicTitles = new Set(originalTopics.map(t => t.title?.trim()).filter(Boolean));
  
  // Raccoglie tutti gli argomenti assegnati
  const assignedTopics = new Set();
  const assignedByDay = new Map();
  
  dailyPlan.forEach(dayPlan => {
    const day = dayPlan.day;
    const topics = (dayPlan.assignedTopics || [])
      .map(t => t.title?.trim())
      .filter(Boolean);
    
    assignedByDay.set(day, topics);
    topics.forEach(title => assignedTopics.add(title));
  });

  logPhase('distribution-validation', `Assegnati: ${assignedTopics.size}/${originalTopicTitles.size} argomenti`);

  // Trova argomenti non assegnati
  const unassignedTopics = Array.from(originalTopicTitles).filter(title => !assignedTopics.has(title));
  
  // Trova argomenti assegnati ma non esistenti (errori AI)
  const invalidAssignments = Array.from(assignedTopics).filter(title => !originalTopicTitles.has(title));

  if (unassignedTopics.length > 0) {
    logPhase('distribution-validation', `Non assegnati: ${unassignedTopics.length} argomenti`);
  }

  if (invalidAssignments.length > 0) {
    logPhase('distribution-validation', `Assegnazioni invalide: ${invalidAssignments.length}`);
  }

  // Correggi la distribuzione
  logPhase('distribution-validation', `Correggendo distribuzione...`);
  const correctedDailyPlan = [];
  
  // Assicura che tutti i giorni 1-totalDays siano presenti
  for (let day = 1; day <= totalDays; day++) {
    const existingDay = dailyPlan.find(d => d.day === day);
    
    if (existingDay) {
      // Filtra topic invalidi
      const validTopics = (existingDay.assignedTopics || [])
        .filter(topic => originalTopicTitles.has(topic.title?.trim()))
        .map(topic => ({
          title: topic.title.trim(),
          description: topic.description || `Studio di ${topic.title.trim()}`,
          estimatedHours: topic.estimatedHours || 3,
          priority: topic.priority || 'medium'
        }));

      const totalPages = validTopics.reduce((sum, topic) => {
        const originalTopic = originalTopics.find(t => t.title?.trim() === topic.title);
        return sum + (originalTopic?.totalPages || 10);
      }, 0);

      correctedDailyPlan.push({
        day: day,
        assignedTopics: validTopics,
        dailyWorkload: {
          totalTopics: validTopics.length,
          totalPages: totalPages,
          estimatedHours: validTopics.reduce((sum, topic) => sum + (topic.estimatedHours || 3), 0),
          difficulty: validTopics.length > 0 ? 'medium' : 'light'
        },
        dayType: validTopics.length > 0 ? 'study' : 'review'
      });
    } else {
      // Giorno mancante - crea giorno vuoto
      correctedDailyPlan.push({
        day: day,
        assignedTopics: [],
        dailyWorkload: {
          totalTopics: 0,
          totalPages: 0,
          estimatedHours: 0,
          difficulty: 'light'
        },
        dayType: 'review'
      });
    }
  }

  // Distribuisci argomenti non assegnati nei giorni con meno carico
  if (unassignedTopics.length > 0) {
    logPhase('distribution-validation', `Ridistribuendo ${unassignedTopics.length} argomenti...`);
    
    for (const topicTitle of unassignedTopics) {
      // Trova il giorno con meno argomenti
      const dayWithLeastTopics = correctedDailyPlan
        .filter(day => day.assignedTopics.length < MODULE_CONFIG.MAX_TOPICS_PER_DAY)
        .sort((a, b) => a.assignedTopics.length - b.assignedTopics.length)[0];
      
      if (dayWithLeastTopics) {
        const originalTopic = originalTopics.find(t => t.title?.trim() === topicTitle);
        
        dayWithLeastTopics.assignedTopics.push({
          title: topicTitle,
          description: originalTopic?.description || `Studio di ${topicTitle}`,
          estimatedHours: originalTopic?.estimatedHours || 3,
          priority: originalTopic?.priority || 'medium'
        });
        
        // Aggiorna workload
        dayWithLeastTopics.dailyWorkload.totalTopics = dayWithLeastTopics.assignedTopics.length;
        dayWithLeastTopics.dailyWorkload.totalPages += originalTopic?.totalPages || 10;
        dayWithLeastTopics.dailyWorkload.estimatedHours += originalTopic?.estimatedHours || 3;
        dayWithLeastTopics.dayType = 'study';
        
        logPhase('distribution-validation', `"${topicTitle}" -> giorno ${dayWithLeastTopics.day}`);
      } else {
        // Se tutti i giorni sono pieni, aggiungi un giorno extra
        const originalTopic = originalTopics.find(t => t.title?.trim() === topicTitle);
        const newDay = {
          day: correctedDailyPlan.length + 1,
          assignedTopics: [{
            title: topicTitle,
            description: originalTopic?.description || `Studio di ${topicTitle}`,
            estimatedHours: originalTopic?.estimatedHours || 3,
            priority: originalTopic?.priority || 'medium'
          }],
          dailyWorkload: {
            totalTopics: 1,
            totalPages: originalTopic?.totalPages || 10,
            estimatedHours: originalTopic?.estimatedHours || 3,
            difficulty: 'medium'
          },
          dayType: 'study'
        };
        
        correctedDailyPlan.push(newDay);
        logPhase('distribution-validation', `"${topicTitle}" -> nuovo giorno ${newDay.day}`);
      }
    }
  }

  // Calcola statistiche finali
  const finalStats = {
    totalDaysUsed: correctedDailyPlan.length,
    totalTopicsDistributed: correctedDailyPlan.reduce((sum, day) => sum + day.assignedTopics.length, 0),
    studyDays: correctedDailyPlan.filter(day => day.dayType === 'study').length,
    reviewDays: correctedDailyPlan.filter(day => day.dayType === 'review').length,
    averageTopicsPerDay: correctedDailyPlan.length > 0 
      ? Math.round((correctedDailyPlan.reduce((sum, day) => sum + day.assignedTopics.length, 0) / correctedDailyPlan.length) * 10) / 10
      : 0,
    averageHoursPerDay: correctedDailyPlan.length > 0
      ? Math.round((correctedDailyPlan.reduce((sum, day) => sum + day.dailyWorkload.estimatedHours, 0) / correctedDailyPlan.length) * 10) / 10
      : 0
  };

  logPhase('distribution-validation', `Statistiche finali: ${finalStats.totalTopicsDistributed}/${originalTopics.length} argomenti, ${finalStats.studyDays}/${finalStats.reviewDays} studio/ripasso`);
  
  return {
    dailyPlan: correctedDailyPlan,
    statistics: finalStats,
    corrections: {
      unassignedTopicsFound: unassignedTopics.length,
      invalidAssignmentsFound: invalidAssignments.length,
      correctionsMade: unassignedTopics.length > 0 || invalidAssignments.length > 0
    },
    originalDistribution: distributionResult
  };
}

// ===== ORCHESTRATORE PRINCIPALE =====

/**
 * Esegue la distribuzione completa degli argomenti
 * INPUT: DistributionInput
 * OUTPUT: DistributionOutput
 */
export async function distributeTopics(input) {
  const { examName, topics, totalDays, userDescription = '', progressCallback } = input;
  
  // Validazione input
  if (!examName || typeof examName !== 'string') {
    throw createPhaseError('distribution', 'examName deve essere una stringa non vuota');
  }
  
  if (!Array.isArray(topics) || topics.length === 0) {
    throw createPhaseError('distribution', 'topics deve essere un array non vuoto');
  }
  
  if (!totalDays || totalDays < 1 || totalDays > 365) {
    throw createPhaseError('distribution', 'totalDays deve essere tra 1 e 365');
  }
  
  logPhase('distribution', `DISTRIBUZIONE ARGOMENTI`);
  logPhase('distribution', `📚 ${examName} | 🗓️ ${totalDays} giorni | 📝 ${topics.length} argomenti`);
  
  try {
    // FASE 1: Distribuzione Equa
    progressCallback?.({ type: 'processing', message: 'Distribuzione equa degli argomenti...' });
    const distributionResult = await executePhaseWithErrorHandling(
      'equitable-distribution',
      phaseEquitableDistribution,
      { examName, topics, totalDays, userDescription, progressCallback }
    );
    
    // FASE 2: Validazione e Correzione
    progressCallback?.({ type: 'processing', message: 'Validazione e correzione distribuzione...' });
    const finalResult = await executePhaseWithErrorHandling(
      'distribution-validation',
      phaseDistributionValidation,
      { distributionResult, totalDays, originalTopics: topics, progressCallback }
    );
    
    const output = createDistributionPhaseOutput('distribution', {
      dailyPlan: finalResult.dailyPlan,
      statistics: finalResult.statistics,
      phaseResults: {
        distribution: distributionResult,
        validation: finalResult
      }
    }, {
      totalTopics: topics.length,
      totalDays: totalDays,
      correctionsMade: finalResult.corrections.correctionsMade
    });

    logPhase('distribution', `DISTRIBUZIONE COMPLETATA: ${output.data.statistics.totalDaysUsed} giorni, ${output.data.statistics.totalTopicsDistributed} argomenti`);
    progressCallback?.({ type: 'processing', message: 'Distribuzione completata!' });
    
    return output;

  } catch (error) {
    logPhase('distribution', `ERRORE DISTRIBUZIONE: ${error.message}`);
    throw createPhaseError('distribution', `Errore distribuzione: ${error.message}`, error);
  }
}

// ===== FUNZIONI LEGACY (per compatibilità con il sistema esistente) =====

/**
 * Funzione legacy per compatibilità con phaseWorkloadAnalysis
 */
export async function legacyWorkloadAnalysis(examName, topics, totalDays, userDescription, progressCallback) {
  logPhase('legacy-compatibility', 'phaseWorkloadAnalysis -> new system');
  return { 
    workloadAnalysis: topics.map(t => ({ 
      topicTitle: t.title, 
      complexity: 3, 
      estimatedHours: t.estimatedHours || 3,
      difficulty: t.difficulty || 'intermediate',
      examImportance: t.priority === 'high' ? 5 : t.priority === 'low' ? 2 : 3
    })),
    overallWorkload: {
      totalEstimatedHours: topics.reduce((sum, t) => sum + (t.estimatedHours || 3), 0),
      averageComplexity: 3.0,
      hoursPerDay: Math.round((topics.reduce((sum, t) => sum + (t.estimatedHours || 3), 0) / totalDays) * 10) / 10
    }
  };
}

/**
 * Funzione legacy per compatibilità con phaseTopicGrouping
 */
export async function legacyTopicGrouping(examName, topics, workloadResult, totalDays, progressCallback) {
  logPhase('legacy-compatibility', 'phaseTopicGrouping -> new system');
  
  const groupsByDifficulty = {
    beginner: topics.filter(t => t.difficulty === 'beginner'),
    intermediate: topics.filter(t => t.difficulty === 'intermediate'),
    advanced: topics.filter(t => t.difficulty === 'advanced')
  };
  
  const topicGroups = Object.entries(groupsByDifficulty)
    .filter(([_, topicsInGroup]) => topicsInGroup.length > 0)
    .map(([difficulty, topicsInGroup]) => ({
      groupName: `Gruppo ${difficulty}`,
      topics: topicsInGroup.map(t => t.title),
      canBeStudiedTogether: true,
      totalComplexity: topicsInGroup.reduce((sum, t) => sum + (t.priority === 'high' ? 5 : 3), 0),
      estimatedTime: topicsInGroup.reduce((sum, t) => sum + (t.estimatedHours || 3), 0)
    }));
  
  return { 
    studySequence: topics.map((topic, index) => ({
      topicTitle: topic.title,
      position: index + 1,
      reasoning: `Posizione ${index + 1} basata su priorità e difficoltà`
    })),
    topicGroups: topicGroups
  };
}

/**
 * Funzione legacy per compatibilità con phaseDayDistribution
 */
export async function legacyDayDistribution(examName, topics, workloadResult, groupingResult, totalDays, progressCallback) {
  logPhase('legacy-compatibility', 'phaseDayDistribution -> new system');
  return await phaseEquitableDistribution({ examName, topics, totalDays, userDescription: '', progressCallback });
}

/**
 * Funzione legacy per compatibilità con phaseBalancingOptimization
 */
export async function legacyBalancingOptimization(distributionResult, totalDays, originalTopics, progressCallback) {
  logPhase('legacy-compatibility', 'phaseBalancingOptimization -> new system');
  return await phaseDistributionValidation({ distributionResult, totalDays, originalTopics, progressCallback });
}

// ===== EXPORT DEFAULT =====
export default {
  distributeTopics,
  MODULE_CONFIG,
  // Legacy functions per compatibilità
  legacyWorkloadAnalysis,
  legacyTopicGrouping,
  legacyDayDistribution,
  legacyBalancingOptimization
};