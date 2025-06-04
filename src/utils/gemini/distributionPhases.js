// src/utils/gemini/distributionPhases.js - VERSIONE COMPLETAMENTE INDIPENDENTE
import { executeAIPhase, CONFIG } from './geminiCore.js';

// ===== CONFIGURAZIONE LOCALE INDIPENDENTE =====
const DISTRIBUTION_CONFIG = {
  MAX_TOPICS_PER_DAY: CONFIG?.DISTRIBUTION?.maxTopicsPerDay || 3,
  RESERVE_REVIEW_DAYS: CONFIG?.DISTRIBUTION?.reserveReviewDays !== false
};

// ===== LOGGING UTILITY ===== 
function logDistributionResult(phaseName, result) {
  console.log(`\n📅 ===== RISULTATO FASE: ${phaseName.toUpperCase()} =====`);
  
  if (result) {
    switch (phaseName) {
      case 'equitable_distribution':
        console.log(`📊 Distribuzione ricevuta:`);
        if (result.dailyDistribution && result.dailyDistribution.length > 0) {
          console.log(`🗓️ Giorni pianificati: ${result.dailyDistribution.length}`);
          
          result.dailyDistribution.forEach(day => {
            const topicsCount = day.assignedTopics?.length || 0;
            const dayType = day.dayType || 'study';
            console.log(`  Giorno ${day.day}: ${topicsCount} argomenti (${dayType})`);
            
            if (day.assignedTopics && day.assignedTopics.length > 0) {
              day.assignedTopics.forEach((topic, i) => {
                console.log(`    ${i + 1}. "${topic.title}" (${topic.estimatedHours || 'N/A'}h, ${topic.priority || 'N/A'})`);
              });
            }
          });
        }
        
        if (result.distributionSummary) {
          console.log(`📈 Riepilogo:`);
          console.log(`  - Giorni utilizzati: ${result.distributionSummary.totalDaysUsed}`);
          console.log(`  - Argomenti distribuiti: ${result.distributionSummary.totalTopicsDistributed}`);
          console.log(`  - Giorni studio: ${result.distributionSummary.studyDays}`);
          console.log(`  - Giorni ripasso: ${result.distributionSummary.reviewDays}`);
          console.log(`  - Media argomenti/giorno: ${result.distributionSummary.averageTopicsPerDay}`);
          console.log(`  - Media ore/giorno: ${result.distributionSummary.averageHoursPerDay}`);
        }
        
        if (result.unassignedTopics && result.unassignedTopics.length > 0) {
          console.log(`⚠️ Argomenti non assegnati: ${result.unassignedTopics.length}`);
          result.unassignedTopics.forEach((topic, i) => {
            console.log(`  ${i + 1}. ${topic}`);
          });
        }
        break;
        
      case 'distribution_validation':
        console.log(`✅ Validazione completata:`);
        if (result.statistics) {
          console.log(`📊 Statistiche finali:`);
          console.log(`  - Giorni totali: ${result.statistics.totalDaysUsed}`);
          console.log(`  - Argomenti distribuiti: ${result.statistics.totalTopicsDistributed}`);
          console.log(`  - Giorni studio: ${result.statistics.studyDays}`);
          console.log(`  - Giorni ripasso: ${result.statistics.reviewDays}`);
          console.log(`  - Media argomenti/giorno: ${result.statistics.averageTopicsPerDay}`);
        }
        
        if (result.corrections) {
          console.log(`🔧 Correzioni applicate:`);
          console.log(`  - Argomenti non assegnati trovati: ${result.corrections.unassignedTopicsFound}`);
          console.log(`  - Assegnazioni invalide trovate: ${result.corrections.invalidAssignmentsFound}`);
          console.log(`  - Correzioni necessarie: ${result.corrections.correctionsMade ? '✅ SÌ' : '❌ NO'}`);
        }
        
        if (result.dailyPlan && result.dailyPlan.length > 0) {
          console.log(`📅 Piano finale (${result.dailyPlan.length} giorni):`);
          result.dailyPlan.slice(0, 10).forEach(day => {
            const topicsCount = day.assignedTopics?.length || 0;
            const hours = day.dailyWorkload?.estimatedHours || 0;
            console.log(`  Giorno ${day.day}: ${topicsCount} argomenti, ${hours}h (${day.dayType})`);
          });
          if (result.dailyPlan.length > 10) {
            console.log(`  ... e altri ${result.dailyPlan.length - 10} giorni`);
          }
        }
        break;
        
      default:
        console.log(`📋 Chiavi risposta:`, Object.keys(result));
    }
  } else {
    console.log(`❌ Risultato vuoto o non valido`);
  }
  
  console.log(`🔚 ===== FINE FASE: ${phaseName.toUpperCase()} =====\n`);
}

// ===== UNICA FASE: Distribuzione Equa degli Argomenti =====
export async function phaseEquitableDistribution(examName, topics, totalDays, userDescription, progressCallback) {
  console.log(`\n🚀 INIZIO FASE: EQUITABLE DISTRIBUTION`);
  console.log(`📚 Esame: ${examName}`);
  console.log(`📝 Argomenti da distribuire: ${topics.length}`);
  console.log(`🗓️ Giorni disponibili: ${totalDays}`);
  console.log(`⚙️ Max argomenti/giorno: ${DISTRIBUTION_CONFIG.MAX_TOPICS_PER_DAY}`);
  
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

  console.log(`📋 Argomenti preparati per l'AI:`);
  topics.forEach((topic, i) => {
    const pages = topic.totalPages || topic.pages_info?.reduce((sum, p) => sum + (p.end_page - p.start_page + 1), 0) || 0;
    console.log(`  ${i + 1}. "${topic.title}" (${pages} pag, ${topic.priority || 'N/A'} priority)`);
  });

  const promptText = `DISTRIBUZIONE EQUA DEGLI ARGOMENTI per l'esame "${examName}" (${totalDays} giorni):

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
3. Massimo ${DISTRIBUTION_CONFIG.MAX_TOPICS_PER_DAY} argomenti per giorno
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
      "dayType": "study" // "study" o "review"
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
  "unassignedTopics": [], // Deve essere vuoto - tutti gli argomenti devono essere assegnati
  "notes": "Strategia di distribuzione utilizzata"
}

IMPORTANTE: 
- Assicurati che la somma di assignedTopics di tutti i giorni sia esattamente ${topics.length}
- Ogni titolo deve corrispondere ESATTAMENTE a uno degli argomenti nella lista
- Tutti i ${totalDays} giorni devono essere specificati (anche se vuoti per ripasso)`;

  console.log(`💭 Prompt preparato (${promptText.length} caratteri)`);
  
  const result = await executeAIPhase('equitable_distribution', promptText, [], [], progressCallback, 'text');
  
  logDistributionResult('equitable_distribution', result);
  return result;
}

// ===== FASE DI VALIDAZIONE E CORREZIONE =====
export async function phaseDistributionValidation(distributionResult, totalDays, originalTopics, progressCallback) {
  console.log(`\n🚀 INIZIO FASE: DISTRIBUTION VALIDATION`);
  console.log(`📊 Input: ${distributionResult?.dailyDistribution?.length || 0} giorni pianificati`);
  console.log(`🎯 Target: ${totalDays} giorni totali, ${originalTopics.length} argomenti`);
  
  progressCallback?.({ type: 'processing', message: 'Validazione e correzione distribuzione...' });

  const dailyPlan = distributionResult.dailyDistribution || [];
  
  // Crea mappa degli argomenti originali per controllo
  const originalTopicTitles = new Set(originalTopics.map(t => t.title?.trim()).filter(Boolean));
  console.log(`📋 Argomenti originali: ${originalTopicTitles.size}`);
  
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

  console.log(`📊 Statistiche assegnazioni AI:`);
  console.log(`  - Argomenti assegnati: ${assignedTopics.size}/${originalTopicTitles.size}`);
  console.log(`  - Giorni pianificati: ${dailyPlan.length}`);

  // Trova argomenti non assegnati
  const unassignedTopics = Array.from(originalTopicTitles).filter(title => !assignedTopics.has(title));
  
  // Trova argomenti assegnati ma non esistenti (errori AI)
  const invalidAssignments = Array.from(assignedTopics).filter(title => !originalTopicTitles.has(title));

  if (unassignedTopics.length > 0) {
    console.log(`⚠️ Argomenti non assegnati (${unassignedTopics.length}):`);
    unassignedTopics.forEach((topic, i) => {
      console.log(`  ${i + 1}. "${topic}"`);
    });
  }

  if (invalidAssignments.length > 0) {
    console.log(`❌ Assegnazioni invalide (${invalidAssignments.length}):`);
    invalidAssignments.forEach((topic, i) => {
      console.log(`  ${i + 1}. "${topic}" (non esiste)`);
    });
  }

  // Correggi la distribuzione
  console.log(`🔧 Iniziando correzione distribuzione...`);
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
      
      console.log(`✅ Giorno ${day}: ${validTopics.length} argomenti validi (${totalPages} pagine)`);
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
      
      console.log(`➕ Giorno ${day}: creato vuoto (ripasso)`);
    }
  }

  // Distribuisci argomenti non assegnati nei giorni con meno carico
  if (unassignedTopics.length > 0) {
    console.log(`🔄 Ridistribuendo ${unassignedTopics.length} argomenti non assegnati...`);
    
    for (const topicTitle of unassignedTopics) {
      // Trova il giorno con meno argomenti
      const dayWithLeastTopics = correctedDailyPlan
        .filter(day => day.assignedTopics.length < DISTRIBUTION_CONFIG.MAX_TOPICS_PER_DAY)
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
        
        console.log(`✅ "${topicTitle}" assegnato al giorno ${dayWithLeastTopics.day}`);
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
        console.log(`➕ "${topicTitle}" assegnato a nuovo giorno ${newDay.day}`);
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

  console.log(`📊 Statistiche finali validazione:`);
  console.log(`  - Giorni utilizzati: ${finalStats.totalDaysUsed}`);
  console.log(`  - Argomenti distribuiti: ${finalStats.totalTopicsDistributed}/${originalTopics.length}`);
  console.log(`  - Giorni studio/ripasso: ${finalStats.studyDays}/${finalStats.reviewDays}`);
  console.log(`  - Media argomenti/giorno: ${finalStats.averageTopicsPerDay}`);
  console.log(`  - Media ore/giorno: ${finalStats.averageHoursPerDay}`);
  
  const result = {
    dailyPlan: correctedDailyPlan,
    statistics: finalStats,
    corrections: {
      unassignedTopicsFound: unassignedTopics.length,
      invalidAssignmentsFound: invalidAssignments.length,
      correctionsMade: unassignedTopics.length > 0 || invalidAssignments.length > 0
    },
    originalDistribution: distributionResult
  };
  
  logDistributionResult('distribution_validation', result);
  return result;
}

// ===== ORCHESTRATORE SEMPLIFICATO =====
export async function distributeTopicsMultiPhase(examName, totalDays, topics, userDescription = "", progressCallback) {
  console.log(`\n🎯 ===== AVVIO DISTRIBUZIONE MULTI-FASE =====`);
  console.log(`📚 Esame: "${examName}"`);
  console.log(`🗓️ Giorni totali: ${totalDays}`);
  console.log(`📝 Argomenti da distribuire: ${topics.length}`);
  console.log(`📋 Descrizione utente: ${userDescription || 'Nessuna'}`);
  console.log(`⚙️ Config: Max ${DISTRIBUTION_CONFIG.MAX_TOPICS_PER_DAY} argomenti/giorno, ripasso: ${DISTRIBUTION_CONFIG.RESERVE_REVIEW_DAYS ? 'SÌ' : 'NO'}`);
  console.log(`=============================================\n`);
  
  try {
    progressCallback?.({ type: 'processing', message: 'Distribuzione equa degli argomenti...' });
    const distributionResult = await phaseEquitableDistribution(examName, topics, totalDays, userDescription, progressCallback);
    
    progressCallback?.({ type: 'processing', message: 'Validazione e correzione distribuzione...' });
    const finalResult = await phaseDistributionValidation(distributionResult, totalDays, topics, progressCallback);
    
    const result = {
      ...finalResult,
      phaseResults: {
        distribution: distributionResult,
        validation: finalResult
      }
    };

    console.log(`\n🎉 ===== DISTRIBUZIONE COMPLETATA =====`);
    console.log(`✅ Giorni pianificati: ${result.statistics.totalDaysUsed}`);
    console.log(`📊 Argomenti distribuiti: ${result.statistics.totalTopicsDistributed}/${topics.length}`);
    console.log(`📈 Studio/Ripasso: ${result.statistics.studyDays}/${result.statistics.reviewDays} giorni`);
    console.log(`⚡ Correzioni: ${result.corrections.correctionsMade ? 'Applicate' : 'Non necessarie'}`);
    console.log(`=====================================\n`);

    progressCallback?.({ type: 'processing', message: 'Distribuzione completata!' });
    return result;

  } catch (error) {
    console.error(`\n❌ ===== ERRORE DISTRIBUZIONE =====`);
    console.error(`💥 Errore:`, error);
    console.error(`=================================\n`);
    throw new Error(`Errore distribuzione: ${error.message}`);
  }
}

// ===== FUNZIONI LEGACY (per compatibilità) =====
export const phaseWorkloadAnalysis = async (examName, topics, totalDays, userDescription, progressCallback) => {
  console.warn('🔄 Distribution: Using legacy phaseWorkloadAnalysis -> redirecting to new system');
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
};

export const phaseTopicGrouping = async (examName, topics, workloadResult, totalDays, progressCallback) => {
  console.warn('🔄 Distribution: Using legacy phaseTopicGrouping -> redirecting to new system');
  
  // Raggruppa argomenti per difficoltà per compatibilità
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
};

export const phaseDayDistribution = async (examName, topics, workloadResult, groupingResult, totalDays, progressCallback) => {
  console.warn('🔄 Distribution: Using legacy phaseDayDistribution -> redirecting to new system');
  return await phaseEquitableDistribution(examName, topics, totalDays, '', progressCallback);
};

export const phaseBalancingOptimization = async (distributionResult, totalDays, originalTopics, progressCallback) => {
  console.warn('🔄 Distribution: Using legacy phaseBalancingOptimization -> redirecting to new system');
  return await phaseDistributionValidation(distributionResult, totalDays, originalTopics, progressCallback);
};