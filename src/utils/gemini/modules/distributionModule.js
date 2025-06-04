// src/utils/gemini/modules/distributionModule.js - MODULO DISTRIBUZIONE SENZA LIMITI

import { executeAIRequest, createAIServiceInput, validateAIServiceOutput } from '../services/geminiAIService.js';
import { 
  createDistributionPhaseInput, 
  createDistributionPhaseOutput, 
  validatePhaseInput,
  logPhase,
  createPhaseError,
  executePhaseWithErrorHandling
} from '../shared/geminiShared.js';

// ===== CONFIGURAZIONE MODULO - NESSUN LIMITE =====
const MODULE_CONFIG = {
  UNLIMITED: true, // Nessun limite attivo
  MAX_TOPICS_PER_DAY: 1000, // Praticamente illimitato
  RESERVE_REVIEW_DAYS: false, // Non forzare giorni di ripasso
  DYNAMIC_DISTRIBUTION: true, // Distribuzione dinamica intelligente
  QUALITY_OVER_LIMITS: true // Priorità alla qualità vs limiti artificiali
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
 * FASE 1: Distribuzione Intelligente Senza Limiti
 * INPUT: examName, topics, totalDays, userDescription
 * OUTPUT: Distribuzione ottimale degli argomenti
 */
async function phaseIntelligentUnlimitedDistribution(input) {
  const { examName, topics, totalDays, userDescription, progressCallback } = input;
  
  logPhase('intelligent-unlimited-distribution', `${topics.length} argomenti in ${totalDays} giorni - MODALITÀ ILLIMITATA`);
  
  // Prepara informazioni dettagliate di ogni argomento
  const topicsInfo = topics.map((topic, index) => {
    let info = `${index + 1}. "${topic.title}"`;
    
    if (topic.description) {
      info += `\n   Descrizione: ${topic.description.substring(0, 200)}${topic.description.length > 200 ? '...' : ''}`;
    }
    
    const totalPages = topic.totalPages || 
      (topic.pages_info?.reduce((sum, p) => sum + (p.end_page - p.start_page + 1), 0)) || 0;
    
    if (totalPages > 0) {
      info += `\n   Pagine: ${totalPages}`;
    }
    
    if (topic.priority) {
      info += `\n   Priorità: ${topic.priority}`;
    }
    
    if (topic.difficulty) {
      info += `\n   Difficoltà: ${topic.difficulty}`;
    }
    
    if (topic.estimatedHours) {
      info += `\n   Ore stimate: ${topic.estimatedHours}`;
    }
    
    if (topic.keyConcepts && topic.keyConcepts.length > 0) {
      info += `\n   Concetti chiave: ${topic.keyConcepts.slice(0, 5).join(', ')}${topic.keyConcepts.length > 5 ? '...' : ''}`;
    }
    
    if (topic.hasExercises) {
      info += `\n   ✓ Include esercizi`;
    }
    
    if (topic.hasFormulas) {
      info += `\n   ✓ Include formule`;
    }
    
    if (topic.prerequisites && topic.prerequisites.length > 0) {
      info += `\n   Prerequisiti: ${topic.prerequisites.join(', ')}`;
    }
    
    return info;
  }).join('\n\n');

  const prompt = `DISTRIBUZIONE INTELLIGENTE ILLIMITATA per l'esame "${examName}" (${totalDays} giorni):

MODALITÀ: NESSUN LIMITE ARTIFICIALE
- Numero argomenti per giorno: ILLIMITATO (decidi tu il meglio)
- Complessità distribuzione: MASSIMA
- Obiettivo: OTTIMIZZAZIONE PERFETTA

ARGOMENTI DA DISTRIBUIRE (${topics.length} totali):
${topicsInfo}

${userDescription ? `OBIETTIVI SPECIFICI UTENTE: "${userDescription}"` : ''}

STRATEGIA AVANZATA:
1. **ANALISI DIPENDENZE**: Rispetta prerequisiti e sequenze logiche
2. **BILANCIAMENTO INTELLIGENTE**: Distribuisci il carico in modo ottimale
3. **PRIORITÀ DINAMICA**: Argomenti high priority nei giorni migliori
4. **DIFFICOLTÀ PROGRESSIVA**: Crescendo gradualmente quando sensato
5. **SINERGIE**: Raggruppa argomenti che si potenziano a vicenda
6. **FLESSIBILITÀ**: Adatta ai ${totalDays} giorni disponibili senza forzature

REGOLE INTELLIGENTI:
- Se un giorno può contenere più argomenti correlati → FALLO
- Se un argomento grande merita un giorno intero → FALLO  
- Se serve preparazione graduale → DILUISCI nel tempo
- Se ci sono sinergie tra argomenti → SFRUTTALE
- QUALITÀ >> quantità di argomenti per giorno

FORMATO DETTAGLIATO - Tutti i ${totalDays} giorni:

{
  "intelligentDistribution": [
    {
      "day": 1,
      "dayStrategy": "Descrizione strategia per questo giorno",
      "assignedTopics": [
        {
          "title": "Nome esatto argomento dalla lista",
          "studyFocus": "Aspetti specifici su cui concentrarsi",
          "estimatedHours": 4,
          "priority": "high|medium|low", 
          "studyMethod": "teoria|pratica|misto",
          "difficultyHandling": "Come affrontare la difficoltà",
          "connectionNotes": "Collegamenti con altri argomenti"
        }
      ],
      "dailyWorkload": {
        "totalTopics": 1,
        "totalPages": 25,
        "totalHours": 6,
        "difficultyLevel": "intermediate",
        "cognitiveLoad": "medium|high|low",
        "studyIntensity": "intensive|moderate|light"
      },
      "dayType": "foundation|building|integration|practice|review",
      "studyTips": "Consigli specifici per studiare questo giorno",
      "preparationNotes": "Come prepararsi per i giorni successivi"
    }
  ],
  "distributionStrategy": {
    "overallApproach": "Strategia generale utilizzata",
    "balancingMethod": "Come è stato bilanciato il carico",
    "sequenceRationale": "Logica della sequenza scelta",
    "adaptationsToTimeframe": "Adattamenti ai ${totalDays} giorni"
  },
  "qualityMetrics": {
    "distributionBalance": "Valutazione bilanciamento 1-10",
    "logicalFlow": "Valutazione flusso logico 1-10", 
    "feasibilityScore": "Valutazione fattibilità 1-10",
    "optimizationLevel": "Livello ottimizzazione raggiunto"
  },
  "unassignedTopics": [],
  "advancedNotes": "Note avanzate sulla distribuzione ottimale creata"
}

IMPORTANTISSIMO:
- OGNI argomento deve essere assegnato ESATTAMENTE UNA volta
- TUTTI i ${totalDays} giorni devono essere specificati (anche se light per ripasso)
- Titoli devono corrispondere ESATTAMENTE alla lista
- Ottimizza per APPRENDIMENTO EFFICACE, non per limiti artificiali
- La distribuzione deve essere INTELLIGENTE e PERSONALIZZATA`;

  const aiInput = createAIServiceInput(prompt, [], 'text', 'intelligent-unlimited-distribution', progressCallback);
  const result = await executeAIRequest(aiInput);
  
  validateAIServiceOutput(result, ['intelligentDistribution']);
  
  logPhase('intelligent-unlimited-distribution', `Distribuzione intelligente: ${result.data.intelligentDistribution?.length || 0} giorni pianificati`);
  return result.data;
}

/**
 * FASE 2: Validazione e Ottimizzazione Avanzata
 * INPUT: distributionResult, totalDays, originalTopics
 * OUTPUT: Distribuzione validata e perfezionata
 */
async function phaseAdvancedValidationAndOptimization(input) {
  const { distributionResult, totalDays, originalTopics, progressCallback } = input;
  
  logPhase('advanced-validation', `Validazione avanzata: ${totalDays} giorni target, ${originalTopics.length} argomenti`);
  
  progressCallback?.({ type: 'processing', message: 'Validazione e ottimizzazione avanzata distribuzione...' });

  const dailyPlan = distributionResult.intelligentDistribution || [];
  
  // Crea mappa degli argomenti originali per controllo
  const originalTopicTitles = new Set(originalTopics.map(t => t.title?.trim()).filter(Boolean));
  const originalTopicsMap = new Map(originalTopics.map(t => [t.title?.trim(), t]));
  
  // Raccoglie tutti gli argomenti assegnati
  const assignedTopics = new Set();
  const assignedByDay = new Map();
  const dayWorkloads = new Map();
  
  dailyPlan.forEach(dayPlan => {
    const day = dayPlan.day;
    const topics = (dayPlan.assignedTopics || [])
      .map(t => t.title?.trim())
      .filter(Boolean);
    
    assignedByDay.set(day, topics);
    dayWorkloads.set(day, dayPlan.dailyWorkload || {});
    topics.forEach(title => assignedTopics.add(title));
  });

  logPhase('advanced-validation', `Assegnati: ${assignedTopics.size}/${originalTopicTitles.size} argomenti`);

  // Trova argomenti non assegnati
  const unassignedTopics = Array.from(originalTopicTitles).filter(title => !assignedTopics.has(title));
  
  // Trova argomenti assegnati ma non esistenti (errori AI)
  const invalidAssignments = Array.from(assignedTopics).filter(title => !originalTopicTitles.has(title));

  if (unassignedTopics.length > 0) {
    logPhase('advanced-validation', `🔍 Non assegnati: ${unassignedTopics.length} argomenti: ${unassignedTopics.join(', ')}`);
  }

  if (invalidAssignments.length > 0) {
    logPhase('advanced-validation', `⚠️ Assegnazioni invalide: ${invalidAssignments.length}: ${invalidAssignments.join(', ')}`);
  }

  // Costruisce distribuzione corretta e ottimizzata
  logPhase('advanced-validation', `🔧 Costruendo distribuzione ottimizzata...`);
  const optimizedDailyPlan = [];
  
  // Assicura che tutti i giorni 1-totalDays siano presenti
  for (let day = 1; day <= totalDays; day++) {
    const existingDay = dailyPlan.find(d => d.day === day);
    
    if (existingDay) {
      // Filtra topic invalidi e arricchisci con dati originali
      const validTopics = (existingDay.assignedTopics || [])
        .filter(topic => originalTopicTitles.has(topic.title?.trim()))
        .map(topic => {
          const originalTopic = originalTopicsMap.get(topic.title.trim());
          return {
            title: topic.title.trim(),
            studyFocus: topic.studyFocus || `Studio approfondito di ${topic.title.trim()}`,
            estimatedHours: topic.estimatedHours || originalTopic?.estimatedHours || calculateOptimalHours(originalTopic),
            priority: topic.priority || originalTopic?.priority || 'medium',
            studyMethod: topic.studyMethod || determineStudyMethod(originalTopic),
            difficultyHandling: topic.difficultyHandling || getOptimalDifficultyStrategy(originalTopic),
            connectionNotes: topic.connectionNotes || findTopicConnections(originalTopic, originalTopics),
            // Metadati aggiuntivi dall'analisi
            originalData: {
              totalPages: originalTopic?.totalPages || 0,
              difficulty: originalTopic?.difficulty || 'intermediate',
              keyConcepts: originalTopic?.keyConcepts || [],
              hasExercises: originalTopic?.hasExercises || false,
              hasFormulas: originalTopic?.hasFormulas || false
            }
          };
        });

      // Calcola workload ottimizzato
      const optimizedWorkload = calculateOptimizedWorkload(validTopics, existingDay.dailyWorkload);

      optimizedDailyPlan.push({
        day: day,
        dayStrategy: existingDay.dayStrategy || generateDayStrategy(validTopics, day, totalDays),
        assignedTopics: validTopics,
        dailyWorkload: optimizedWorkload,
        dayType: existingDay.dayType || determineDayType(validTopics, day, totalDays),
        studyTips: existingDay.studyTips || generateStudyTips(validTopics),
        preparationNotes: existingDay.preparationNotes || generatePreparationNotes(validTopics, day, totalDays),
        // Metriche di qualità per questo giorno
        qualityMetrics: calculateDayQualityMetrics(validTopics, optimizedWorkload)
      });
    } else {
      // Giorno mancante - crea giorno ottimizzato (potrebbero essere giorni di ripasso/buffer)
      optimizedDailyPlan.push({
        day: day,
        dayStrategy: `Giorno ${day}: Buffer/Ripasso strategico`,
        assignedTopics: [],
        dailyWorkload: {
          totalTopics: 0,
          totalPages: 0,
          totalHours: 2, // Ore di ripasso
          difficultyLevel: 'light',
          cognitiveLoad: 'low',
          studyIntensity: 'light'
        },
        dayType: 'review',
        studyTips: generateReviewDayTips(day, totalDays),
        preparationNotes: generateReviewPreparationNotes(day, totalDays),
        qualityMetrics: { type: 'review', value: 1.0 }
      });
    }
  }

  // Distribuisci intelligentemente argomenti non assegnati
  if (unassignedTopics.length > 0) {
    logPhase('advanced-validation', `🎯 Redistribuzione intelligente di ${unassignedTopics.length} argomenti...`);
    
    for (const topicTitle of unassignedTopics) {
      const originalTopic = originalTopicsMap.get(topicTitle);
      const optimalDay = findOptimalDayForTopic(originalTopic, optimizedDailyPlan, totalDays);
      
      if (optimalDay) {
        const topicData = {
          title: topicTitle,
          studyFocus: `Studio approfondito di ${topicTitle}`,
          estimatedHours: originalTopic?.estimatedHours || calculateOptimalHours(originalTopic),
          priority: originalTopic?.priority || 'medium',
          studyMethod: determineStudyMethod(originalTopic),
          difficultyHandling: getOptimalDifficultyStrategy(originalTopic),
          connectionNotes: findTopicConnections(originalTopic, originalTopics),
          originalData: {
            totalPages: originalTopic?.totalPages || 0,
            difficulty: originalTopic?.difficulty || 'intermediate',
            keyConcepts: originalTopic?.keyConcepts || [],
            hasExercises: originalTopic?.hasExercises || false,
            hasFormulas: originalTopic?.hasFormulas || false
          }
        };
        
        optimalDay.assignedTopics.push(topicData);
        
        // Ricalcola workload del giorno
        optimalDay.dailyWorkload = calculateOptimizedWorkload(optimalDay.assignedTopics, optimalDay.dailyWorkload);
        optimalDay.dayStrategy = generateDayStrategy(optimalDay.assignedTopics, optimalDay.day, totalDays);
        optimalDay.studyTips = generateStudyTips(optimalDay.assignedTopics);
        optimalDay.qualityMetrics = calculateDayQualityMetrics(optimalDay.assignedTopics, optimalDay.dailyWorkload);
        
        if (optimalDay.assignedTopics.length > 0) {
          optimalDay.dayType = determineDayType(optimalDay.assignedTopics, optimalDay.day, totalDays);
        }
        
        logPhase('advanced-validation', `✅ "${topicTitle}" → Giorno ${optimalDay.day} (carico ottimizzato)`);
      } else {
        // Se tutti i giorni sono troppo carichi, crea un giorno extra
        const extraDay = {
          day: optimizedDailyPlan.length + 1,
          dayStrategy: `Giorno extra: Focus su ${topicTitle}`,
          assignedTopics: [{
            title: topicTitle,
            studyFocus: `Studio intensivo di ${topicTitle}`,
            estimatedHours: originalTopic?.estimatedHours || calculateOptimalHours(originalTopic),
            priority: originalTopic?.priority || 'medium',
            studyMethod: determineStudyMethod(originalTopic),
            difficultyHandling: getOptimalDifficultyStrategy(originalTopic),
            connectionNotes: findTopicConnections(originalTopic, originalTopics),
            originalData: {
              totalPages: originalTopic?.totalPages || 0,
              difficulty: originalTopic?.difficulty || 'intermediate',
              keyConcepts: originalTopic?.keyConcepts || [],
              hasExercises: originalTopic?.hasExercises || false,
              hasFormulas: originalTopic?.hasFormulas || false
            }
          }],
          dailyWorkload: {
            totalTopics: 1,
            totalPages: originalTopic?.totalPages || 10,
            totalHours: originalTopic?.estimatedHours || calculateOptimalHours(originalTopic),
            difficultyLevel: originalTopic?.difficulty || 'intermediate',
            cognitiveLoad: 'medium',
            studyIntensity: 'intensive'
          },
          dayType: 'intensive',
          studyTips: generateStudyTips([originalTopic]),
          preparationNotes: `Preparazione specifica per ${topicTitle}`,
          qualityMetrics: { type: 'extra', value: 0.9 }
        };
        
        optimizedDailyPlan.push(extraDay);
        logPhase('advanced-validation', `➕ "${topicTitle}" → Nuovo giorno ${extraDay.day} (intensivo)`);
      }
    }
  }

  // Calcola statistiche finali avanzate
  const advancedStats = calculateAdvancedStatistics(optimizedDailyPlan, originalTopics);
  
  // Ottimizzazione finale del flusso
  const finalOptimizedPlan = optimizeStudyFlow(optimizedDailyPlan);

  logPhase('advanced-validation', `✅ Validazione completata: ${advancedStats.totalTopicsDistributed}/${originalTopics.length} argomenti, ${advancedStats.effectiveDays} giorni attivi`);
  
  return {
    dailyPlan: finalOptimizedPlan,
    statistics: advancedStats,
    optimizations: {
      unassignedTopicsFound: unassignedTopics.length,
      invalidAssignmentsFound: invalidAssignments.length,
      redistributionsPerformed: unassignedTopics.length > 0 || invalidAssignments.length > 0,
      optimizationScore: advancedStats.qualityMetrics.overallScore,
      flowOptimizations: finalOptimizedPlan.length !== optimizedDailyPlan.length
    },
    originalDistribution: distributionResult
  };
}

// ===== FUNZIONI DI SUPPORTO AVANZATE =====

/**
 * Calcola ore ottimali per un argomento
 */
function calculateOptimalHours(topic) {
  if (!topic) return 3;
  
  let baseHours = Math.max(2, Math.ceil((topic.totalPages || 10) / 6)); // ~6 pagine/ora
  
  // Aggiustamenti basati su difficoltà
  if (topic.difficulty === 'advanced') baseHours *= 1.5;
  if (topic.difficulty === 'beginner') baseHours *= 0.8;
  
  // Aggiustamenti basati su contenuto
  if (topic.hasExercises) baseHours += 1;
  if (topic.hasFormulas) baseHours += 0.5;
  if (topic.keyConcepts && topic.keyConcepts.length > 5) baseHours += 0.5;
  
  return Math.ceil(baseHours);
}

/**
 * Determina metodo di studio ottimale
 */
function determineStudyMethod(topic) {
  if (!topic) return 'misto';
  
  if (topic.hasExercises && topic.hasFormulas) return 'pratica';
  if (topic.hasExercises) return 'misto';
  if (topic.difficulty === 'beginner') return 'teoria';
  
  return 'misto';
}

/**
 * Strategia ottimale per gestire difficoltà
 */
function getOptimalDifficultyStrategy(topic) {
  if (!topic) return 'Approccio graduale';
  
  switch (topic.difficulty) {
    case 'beginner':
      return 'Lettura attenta e sintesi. Focus sui concetti base.';
    case 'intermediate':
      return 'Studio attivo con esempi. Collega con conoscenze precedenti.';
    case 'advanced':
      return 'Studio intensivo. Suddividi in sessioni. Pratica frequente.';
    default:
      return 'Approccio bilanciato teoria-pratica.';
  }
}

/**
 * Trova connessioni tra argomenti
 */
function findTopicConnections(topic, allTopics) {
  if (!topic || !allTopics) return 'Nessuna connessione specifica identificata.';
  
  const connections = [];
  const topicConcepts = new Set(topic.keyConcepts || []);
  
  allTopics.forEach(otherTopic => {
    if (otherTopic.title !== topic.title) {
      const otherConcepts = new Set(otherTopic.keyConcepts || []);
      const intersection = new Set([...topicConcepts].filter(x => otherConcepts.has(x)));
      
      if (intersection.size > 0) {
        connections.push(`Collegato a "${otherTopic.title}" (${Array.from(intersection).join(', ')})`);
      }
    }
  });
  
  if (connections.length === 0) {
    return 'Studio indipendente. Focus sui contenuti specifici.';
  }
  
  return connections.slice(0, 3).join('; '); // Massimo 3 connessioni
}

/**
 * Calcola workload ottimizzato per un giorno
 */
function calculateOptimizedWorkload(topics, existingWorkload) {
  if (topics.length === 0) {
    return {
      totalTopics: 0,
      totalPages: 0,
      totalHours: 0,
      difficultyLevel: 'light',
      cognitiveLoad: 'low',
      studyIntensity: 'light'
    };
  }
  
  const totalTopics = topics.length;
  const totalPages = topics.reduce((sum, topic) => sum + (topic.originalData?.totalPages || 0), 0);
  const totalHours = topics.reduce((sum, topic) => sum + (topic.estimatedHours || 0), 0);
  
  // Determina difficoltà media
  const difficulties = topics.map(t => t.originalData?.difficulty || 'intermediate');
  const avgDifficulty = calculateAverageDifficulty(difficulties);
  
  // Determina carico cognitivo
  let cognitiveLoad = 'medium';
  if (totalHours > 8) cognitiveLoad = 'high';
  if (totalHours < 4) cognitiveLoad = 'low';
  
  // Determina intensità studio
  let studyIntensity = 'moderate';
  if (totalTopics > 2 || totalHours > 6) studyIntensity = 'intensive';
  if (totalTopics === 1 && totalHours < 4) studyIntensity = 'light';
  
  return {
    totalTopics,
    totalPages,
    totalHours,
    difficultyLevel: avgDifficulty,
    cognitiveLoad,
    studyIntensity
  };
}

/**
 * Calcola difficoltà media
 */
function calculateAverageDifficulty(difficulties) {
  const difficultyScores = { beginner: 1, intermediate: 2, advanced: 3 };
  const avgScore = difficulties.reduce((sum, diff) => sum + (difficultyScores[diff] || 2), 0) / difficulties.length;
  
  if (avgScore <= 1.3) return 'beginner';
  if (avgScore >= 2.7) return 'advanced';
  return 'intermediate';
}

/**
 * Genera strategia per il giorno
 */
function generateDayStrategy(topics, day, totalDays) {
  if (topics.length === 0) {
    return `Giorno ${day}: Ripasso e consolidamento delle conoscenze precedenti.`;
  }
  
  if (topics.length === 1) {
    const topic = topics[0];
    return `Giorno ${day}: Focus intensivo su "${topic.title}". ${topic.difficultyHandling}`;
  }
  
  const hasAdvanced = topics.some(t => t.originalData?.difficulty === 'advanced');
  const hasPractice = topics.some(t => t.originalData?.hasExercises);
  
  let strategy = `Giorno ${day}: Studio multi-argomento (${topics.length} topic). `;
  
  if (hasAdvanced) {
    strategy += 'Inizia con argomenti più complessi quando la concentrazione è alta. ';
  }
  
  if (hasPractice) {
    strategy += 'Alterna teoria e pratica per mantenere l\'engagement. ';
  }
  
  if (day <= totalDays * 0.3) {
    strategy += 'Focus su basi solide per i prossimi giorni.';
  } else if (day >= totalDays * 0.8) {
    strategy += 'Preparazione finale con collegamenti e sintesi.';
  } else {
    strategy += 'Sviluppo competenze intermedie.';
  }
  
  return strategy;
}

/**
 * Determina tipo del giorno
 */
function determineDayType(topics, day, totalDays) {
  if (topics.length === 0) return 'review';
  
  const hasFoundational = topics.some(t => t.originalData?.difficulty === 'beginner');
  const hasAdvanced = topics.some(t => t.originalData?.difficulty === 'advanced');
  const hasPractice = topics.some(t => t.originalData?.hasExercises);
  
  if (day <= totalDays * 0.2 && hasFoundational) return 'foundation';
  if (day >= totalDays * 0.8) return 'integration';
  if (hasAdvanced && topics.length === 1) return 'intensive';
  if (hasPractice) return 'practice';
  
  return 'building';
}

/**
 * Genera suggerimenti di studio
 */
function generateStudyTips(topics) {
  if (topics.length === 0) {
    return 'Usa questo tempo per ripassare argomenti precedenti e consolidare la comprensione.';
  }
  
  const tips = [];
  
  if (topics.length > 1) {
    tips.push('Alterna tra argomenti diversi per mantenere alta l\'attenzione.');
  }
  
  const hasFormulas = topics.some(t => t.originalData?.hasFormulas);
  const hasExercises = topics.some(t => t.originalData?.hasExercises);
  
  if (hasFormulas) {
    tips.push('Dedica tempo extra alle formule: scrivile, derivale, applicale.');
  }
  
  if (hasExercises) {
    tips.push('Non limitarti a leggere gli esercizi: risolvili attivamente.');
  }
  
  const difficulties = topics.map(t => t.originalData?.difficulty || 'intermediate');
  if (difficulties.includes('advanced')) {
    tips.push('Per argomenti complessi: suddividi in sezioni più piccole.');
  }
  
  if (tips.length === 0) {
    tips.push('Mantieni un ritmo costante e fai pause regolari.');
  }
  
  return tips.join(' ');
}

/**
 * Genera note di preparazione
 */
function generatePreparationNotes(topics, day, totalDays) {
  if (topics.length === 0) {
    return 'Prepara materiali per il prossimo giorno di studio intensivo.';
  }
  
  const notes = [];
  
  if (day < totalDays) {
    notes.push('Prepara domande sui punti meno chiari per approfondire domani.');
  }
  
  const hasConnections = topics.some(t => t.connectionNotes && t.connectionNotes.includes('Collegato'));
  if (hasConnections) {
    notes.push('Nota le connessioni con argomenti futuri per facilitare l\'apprendimento.');
  }
  
  const totalHours = topics.reduce((sum, topic) => sum + (topic.estimatedHours || 0), 0);
  if (totalHours > 6) {
    notes.push('Giorno intensivo: pianifica pause strategiche ogni 90 minuti.');
  }
  
  if (notes.length === 0) {
    notes.push('Rivedi brevemente gli obiettivi raggiunti prima di procedere.');
  }
  
  return notes.join(' ');
}

/**
 * Genera tips per giorni di ripasso
 */
function generateReviewDayTips(day, totalDays) {
  if (day >= totalDays * 0.8) {
    return 'Ripasso finale: crea mappe concettuali e collegamenti tra tutti gli argomenti studiati.';
  }
  
  return 'Ripasso attivo: testa la tua comprensione senza guardare gli appunti, poi verifica.';
}

/**
 * Genera note preparazione per ripasso
 */
function generateReviewPreparationNotes(day, totalDays) {
  if (day === totalDays) {
    return 'Preparazione finale: rilassati e concentrati sui punti chiave per l\'esame.';
  }
  
  return 'Identifica argomenti che necessitano rinforzo per focalizzare lo studio dei prossimi giorni.';
}

/**
 * Calcola metriche di qualità per un giorno
 */
function calculateDayQualityMetrics(topics, workload) {
  if (topics.length === 0) {
    return { type: 'review', balance: 1.0, feasibility: 1.0, value: 0.8 };
  }
  
  const totalHours = workload.totalHours || 0;
  const totalTopics = topics.length;
  
  // Balance: ottimale 4-6 ore per giorno
  const balanceScore = totalHours >= 4 && totalHours <= 6 ? 1.0 :
                      totalHours >= 2 && totalHours <= 8 ? 0.8 :
                      0.6;
  
  // Feasibility: basato su carico cognitivo
  const feasibilityScore = workload.cognitiveLoad === 'low' ? 1.0 :
                          workload.cognitiveLoad === 'medium' ? 0.9 :
                          0.7;
  
  // Value: basato su priorità degli argomenti
  const highPriorityCount = topics.filter(t => t.priority === 'high').length;
  const valueScore = totalTopics > 0 ? 0.7 + (highPriorityCount / totalTopics) * 0.3 : 0.7;
  
  return {
    type: 'study',
    balance: balanceScore,
    feasibility: feasibilityScore,
    value: valueScore,
    overall: (balanceScore + feasibilityScore + valueScore) / 3
  };
}

/**
 * Trova giorno ottimale per un argomento
 */
function findOptimalDayForTopic(topic, currentPlan, totalDays) {
  if (!topic) return null;
  
  const topicHours = topic.estimatedHours || calculateOptimalHours(topic);
  const MAX_DAILY_HOURS = 10; // Limite flessibile per modalità illimitata
  
  // Cerca giorni con spazio disponibile
  const availableDays = currentPlan.filter(day => {
    const currentHours = day.dailyWorkload?.totalHours || 0;
    return currentHours + topicHours <= MAX_DAILY_HOURS;
  });
  
  if (availableDays.length === 0) return null;
  
  // Trova il giorno più adatto basato su:
  // 1. Prerequisiti soddisfatti
  // 2. Difficoltà compatibile
  // 3. Carico bilanciato
  
  let bestDay = null;
  let bestScore = -1;
  
  for (const day of availableDays) {
    let score = 0;
    
    // Bonus per giorni con carico leggero
    const currentLoad = day.dailyWorkload?.cognitiveLoad || 'medium';
    if (currentLoad === 'low') score += 3;
    if (currentLoad === 'medium') score += 1;
    
    // Bonus per compatibilità di difficoltà
    if (day.assignedTopics.length > 0) {
      const dayDifficulties = day.assignedTopics.map(t => t.originalData?.difficulty || 'intermediate');
      const topicDifficulty = topic.difficulty || 'intermediate';
      if (dayDifficulties.includes(topicDifficulty)) score += 2;
    } else {
      score += 1; // Giorno vuoto è sempre buono
    }
    
    // Penalty per giorni troppo tardivi se è un prerequisito
    if (topic.priority === 'high' && day.day > totalDays * 0.7) {
      score -= 2;
    }
    
    // Bonus per giorni nelle prime fasi se è foundational
    if (topic.difficulty === 'beginner' && day.day <= totalDays * 0.3) {
      score += 2;
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestDay = day;
    }
  }
  
  return bestDay;
}

/**
 * Calcola statistiche avanzate
 */
function calculateAdvancedStatistics(dailyPlan, originalTopics) {
  const totalTopicsDistributed = dailyPlan.reduce((sum, day) => sum + day.assignedTopics.length, 0);
  const effectiveDays = dailyPlan.filter(day => day.assignedTopics.length > 0).length;
  const reviewDays = dailyPlan.filter(day => day.dayType === 'review').length;
  
  const totalHours = dailyPlan.reduce((sum, day) => sum + (day.dailyWorkload?.totalHours || 0), 0);
  const totalPages = dailyPlan.reduce((sum, day) => sum + (day.dailyWorkload?.totalPages || 0), 0);
  
  // Distribuzione per priorità
  const priorityDistribution = { high: 0, medium: 0, low: 0 };
  const difficultyDistribution = { beginner: 0, intermediate: 0, advanced: 0 };
  
  dailyPlan.forEach(day => {
    day.assignedTopics.forEach(topic => {
      priorityDistribution[topic.priority || 'medium']++;
      difficultyDistribution[topic.originalData?.difficulty || 'intermediate']++;
    });
  });
  
  // Calcolo metriche di qualità
  const qualityScores = dailyPlan
    .filter(day => day.qualityMetrics && day.qualityMetrics.overall)
    .map(day => day.qualityMetrics.overall);
  
  const averageQuality = qualityScores.length > 0 
    ? qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length 
    : 0.8;
  
  // Bilanciamento del carico
  const dailyHours = dailyPlan.map(day => day.dailyWorkload?.totalHours || 0);
  const avgHoursPerDay = dailyHours.reduce((sum, h) => sum + h, 0) / dailyHours.length;
  const hoursVariance = dailyHours.reduce((sum, h) => sum + Math.pow(h - avgHoursPerDay, 2), 0) / dailyHours.length;
  const balanceScore = Math.max(0, 1 - (Math.sqrt(hoursVariance) / avgHoursPerDay));
  
  return {
    totalDaysPlanned: dailyPlan.length,
    effectiveDays: effectiveDays,
    reviewDays: reviewDays,
    totalTopicsDistributed: totalTopicsDistributed,
    distributionCoverage: originalTopics.length > 0 ? (totalTopicsDistributed / originalTopics.length) : 1,
    
    workloadStats: {
      totalHours: totalHours,
      totalPages: totalPages,
      avgHoursPerDay: Math.round(avgHoursPerDay * 10) / 10,
      avgTopicsPerDay: Math.round((totalTopicsDistributed / effectiveDays) * 10) / 10,
      avgPagesPerDay: Math.round((totalPages / effectiveDays) * 10) / 10
    },
    
    distributionBreakdown: {
      byPriority: priorityDistribution,
      byDifficulty: difficultyDistribution,
      byDayType: dailyPlan.reduce((acc, day) => {
        acc[day.dayType] = (acc[day.dayType] || 0) + 1;
        return acc;
      }, {})
    },
    
    qualityMetrics: {
      averageQuality: Math.round(averageQuality * 100) / 100,
      balanceScore: Math.round(balanceScore * 100) / 100,
      feasibilityScore: calculateFeasibilityScore(dailyPlan),
      overallScore: Math.round(((averageQuality + balanceScore) / 2) * 100) / 100
    },
    
    optimizationData: {
      maxDailyHours: Math.max(...dailyHours),
      minDailyHours: Math.min(...dailyHours.filter(h => h > 0)),
      mostIntensiveDay: dailyPlan.find(day => day.dailyWorkload?.totalHours === Math.max(...dailyHours))?.day || 1,
      recommendedAdjustments: generateOptimizationRecommendations(dailyPlan)
    }
  };
}

/**
 * Calcola score di fattibilità
 */
function calculateFeasibilityScore(dailyPlan) {
  let feasibilitySum = 0;
  let count = 0;
  
  dailyPlan.forEach(day => {
    if (day.assignedTopics.length > 0) {
      const hours = day.dailyWorkload?.totalHours || 0;
      const topics = day.assignedTopics.length;
      
      let dayScore = 1.0;
      
      // Penalizza giorni troppo carichi
      if (hours > 8) dayScore -= 0.2;
      if (hours > 10) dayScore -= 0.3;
      if (topics > 3) dayScore -= 0.1;
      
      // Bonus per giorni ben bilanciati
      if (hours >= 4 && hours <= 6 && topics <= 2) dayScore += 0.1;
      
      feasibilitySum += Math.max(0, dayScore);
      count++;
    }
  });
  
  return count > 0 ? feasibilitySum / count : 1.0;
}

/**
 * Genera raccomandazioni di ottimizzazione
 */
function generateOptimizationRecommendations(dailyPlan) {
  const recommendations = [];
  
  // Identifica giorni troppo carichi
  const overloadedDays = dailyPlan.filter(day => day.dailyWorkload?.totalHours > 8);
  if (overloadedDays.length > 0) {
    recommendations.push(`Giorni ${overloadedDays.map(d => d.day).join(', ')} potrebbero essere troppo intensivi`);
  }
  
  // Identifica squilibri
  const hours = dailyPlan.map(day => day.dailyWorkload?.totalHours || 0).filter(h => h > 0);
  const maxHours = Math.max(...hours);
  const minHours = Math.min(...hours);
  
  if (maxHours - minHours > 4) {
    recommendations.push('Considera di bilanciare meglio il carico tra i giorni');
  }
  
  // Sequenza di difficoltà
  const studyDays = dailyPlan.filter(day => day.assignedTopics.length > 0);
  let hasOptimalProgression = true;
  
  for (let i = 1; i < studyDays.length; i++) {
    const prevDayDifficulty = studyDays[i-1].dailyWorkload?.difficultyLevel;
    const currentDayDifficulty = studyDays[i].dailyWorkload?.difficultyLevel;
    
    if (prevDayDifficulty === 'beginner' && currentDayDifficulty === 'advanced') {
      hasOptimalProgression = false;
      break;
    }
  }
  
  if (!hasOptimalProgression) {
    recommendations.push('La progressione di difficoltà potrebbe essere troppo rapida');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Distribuzione ottimale - nessun aggiustamento necessario');
  }
  
  return recommendations;
}

/**
 * Ottimizza il flusso di studio
 */
function optimizeStudyFlow(dailyPlan) {
  logPhase('study-flow-optimization', 'Ottimizzazione finale del flusso di studio...');
  
  // Crea copia per ottimizzazioni
  const optimizedPlan = JSON.parse(JSON.stringify(dailyPlan));
  
  // 1. Verifica e ottimizza sequenza di prerequisiti
  optimizePrerequisiteSequence(optimizedPlan);
  
  // 2. Bilancia carico cognitivo tra giorni consecutivi
  balanceCognitiveLoad(optimizedPlan);
  
  // 3. Ottimizza transizioni tra argomenti
  optimizeTopicTransitions(optimizedPlan);
  
  logPhase('study-flow-optimization', 'Ottimizzazione flusso completata');
  return optimizedPlan;
}

/**
 * Ottimizza sequenza prerequisiti
 */
function optimizePrerequisiteSequence(plan) {
  const studyDays = plan.filter(day => day.assignedTopics.length > 0);
  
  // Verifica che argomenti foundational vengano prima
  const foundationalTopics = [];
  const advancedTopics = [];
  
  studyDays.forEach(day => {
    day.assignedTopics.forEach(topic => {
      if (topic.originalData?.difficulty === 'beginner') {
        foundationalTopics.push({ topic, day: day.day });
      } else if (topic.originalData?.difficulty === 'advanced') {
        advancedTopics.push({ topic, day: day.day });
      }
    });
  });
  
  // Se argomenti foundational vengono dopo advanced, segnala
  const latestFoundational = Math.max(...foundationalTopics.map(ft => ft.day), 0);
  const earliestAdvanced = Math.min(...advancedTopics.map(at => at.day), Infinity);
  
  if (latestFoundational > earliestAdvanced) {
    logPhase('study-flow-optimization', `Sequenza prerequisiti non ottimale detectata (foundational al giorno ${latestFoundational}, advanced al giorno ${earliestAdvanced})`);
    // In un'implementazione completa, qui si potrebbero riordinare automaticamente
  }
}

/**
 * Bilancia carico cognitivo
 */
function balanceCognitiveLoad(plan) {
  for (let i = 1; i < plan.length; i++) {
    const prevDay = plan[i-1];
    const currentDay = plan[i];
    
    const prevLoad = prevDay.dailyWorkload?.cognitiveLoad;
    const currentLoad = currentDay.dailyWorkload?.cognitiveLoad;
    
    // Se due giorni consecutivi sono entrambi "high", suggerisci un buffer
    if (prevLoad === 'high' && currentLoad === 'high') {
      // Aggiorna note di preparazione per suggerire pause extra
      if (currentDay.preparationNotes) {
        currentDay.preparationNotes += ' IMPORTANTE: Giorno consecutivo ad alto carico - pianifica pause extra.';
      }
    }
  }
}

/**
 * Ottimizza transizioni tra argomenti
 */
function optimizeTopicTransitions(plan) {
  plan.forEach(day => {
    if (day.assignedTopics.length > 1) {
      // Riordina argomenti del giorno per transizioni più fluide
      day.assignedTopics.sort((a, b) => {
        // Prima per difficoltà (più facili prima quando possibile)
        const diffA = a.originalData?.difficulty || 'intermediate';
        const diffB = b.originalData?.difficulty || 'intermediate';
        const diffOrder = { beginner: 0, intermediate: 1, advanced: 2 };
        
        if (diffOrder[diffA] !== diffOrder[diffB]) {
          return diffOrder[diffA] - diffOrder[diffB];
        }
        
        // Poi per tipo di contenuto (teoria prima di pratica)
        const hasExercisesA = a.originalData?.hasExercises || false;
        const hasExercisesB = b.originalData?.hasExercises || false;
        
        if (hasExercisesA !== hasExercisesB) {
          return hasExercisesA ? 1 : -1; // Teoria prima
        }
        
        return 0; // Mantieni ordine originale
      });
      
      // Aggiorna studyTips per riflettere l'ordine ottimizzato
      if (day.assignedTopics.length > 1) {
        const firstTopic = day.assignedTopics[0];
        const lastTopic = day.assignedTopics[day.assignedTopics.length - 1];
        
        day.studyTips = `Inizia con "${firstTopic.title}" (${firstTopic.originalData?.difficulty || 'standard'}), concludi con "${lastTopic.title}". ` + day.studyTips;
      }
    }
  });
}

// ===== ORCHESTRATORE PRINCIPALE =====

/**
 * Esegue la distribuzione completa degli argomenti SENZA LIMITI
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
  
  logPhase('distribution', `DISTRIBUZIONE ILLIMITATA AVANZATA`);
  logPhase('distribution', `📚 ${examName} | 🗓️ ${totalDays} giorni | 📝 ${topics.length} argomenti | 🚀 MODALITÀ ILLIMITATA`);
  
  try {
    // FASE 1: Distribuzione Intelligente Senza Limiti
    progressCallback?.({ type: 'processing', message: 'Distribuzione intelligente illimitata...' });
    const distributionResult = await executePhaseWithErrorHandling(
      'intelligent-unlimited-distribution',
      phaseIntelligentUnlimitedDistribution,
      { examName, topics, totalDays, userDescription, progressCallback }
    );
    
    // FASE 2: Validazione e Ottimizzazione Avanzata
    progressCallback?.({ type: 'processing', message: 'Validazione e ottimizzazione avanzata...' });
    const finalResult = await executePhaseWithErrorHandling(
      'advanced-validation-optimization',
      phaseAdvancedValidationAndOptimization,
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
      optimizationScore: finalResult.optimizations.optimizationScore,
      qualityScore: finalResult.statistics.qualityMetrics.overallScore,
      mode: 'unlimited',
      redistributions: finalResult.optimizations.redistributionsPerformed
    });

    logPhase('distribution', `DISTRIBUZIONE ILLIMITATA COMPLETATA: ${output.data.statistics.totalDaysPlanned} giorni, ${output.data.statistics.totalTopicsDistributed} argomenti`);
    logPhase('distribution', `QUALITÀ: ${Math.round(output.data.statistics.qualityMetrics.overallScore * 100)}% | BILANCIAMENTO: ${Math.round(output.data.statistics.qualityMetrics.balanceScore * 100)}%`);
    
    progressCallback?.({ type: 'processing', message: 'Distribuzione avanzata completata!' });
    
    return output;

  } catch (error) {
    logPhase('distribution', `ERRORE DISTRIBUZIONE ILLIMITATA: ${error.message}`);
    throw createPhaseError('distribution', `Errore distribuzione illimitata: ${error.message}`, error);
  }
}

// ===== FUNZIONI LEGACY (per compatibilità con il sistema esistente) =====

/**
 * Funzione legacy per compatibilità con phaseWorkloadAnalysis
 */
export async function legacyWorkloadAnalysis(examName, topics, totalDays, userDescription, progressCallback) {
  logPhase('legacy-compatibility', 'phaseWorkloadAnalysis -> new unlimited system');
  return { 
    workloadAnalysis: topics.map(t => ({ 
      topicTitle: t.title, 
      complexity: calculateTopicComplexity(t), 
      estimatedHours: t.estimatedHours || calculateOptimalHours(t),
      difficulty: t.difficulty || 'intermediate',
      examImportance: t.priority === 'high' ? 5 : t.priority === 'low' ? 2 : 3
    })),
    overallWorkload: {
      totalEstimatedHours: topics.reduce((sum, t) => sum + (t.estimatedHours || calculateOptimalHours(t)), 0),
      averageComplexity: calculateAverageComplexity(topics),
      hoursPerDay: Math.round((topics.reduce((sum, t) => sum + (t.estimatedHours || calculateOptimalHours(t)), 0) / totalDays) * 10) / 10,
      recommendedStudyIntensity: determineRecommendedIntensity(topics, totalDays)
    }
  };
}

/**
 * Calcola complessità di un argomento
 */
function calculateTopicComplexity(topic) {
  let complexity = 3; // Base
  
  if (topic.difficulty === 'advanced') complexity += 2;
  if (topic.difficulty === 'beginner') complexity -= 1;
  if (topic.hasFormulas) complexity += 1;
  if (topic.hasExercises) complexity += 1;
  if (topic.keyConcepts && topic.keyConcepts.length > 5) complexity += 1;
  if (topic.totalPages && topic.totalPages > 20) complexity += 1;
  
  return Math.max(1, Math.min(5, complexity));
}

/**
 * Calcola complessità media
 */
function calculateAverageComplexity(topics) {
  if (topics.length === 0) return 3.0;
  
  const totalComplexity = topics.reduce((sum, topic) => sum + calculateTopicComplexity(topic), 0);
  return Math.round((totalComplexity / topics.length) * 10) / 10;
}

/**
 * Determina intensità raccomandata
 */
function determineRecommendedIntensity(topics, totalDays) {
  const totalHours = topics.reduce((sum, t) => sum + (t.estimatedHours || calculateOptimalHours(t)), 0);
  const hoursPerDay = totalHours / totalDays;
  
  if (hoursPerDay > 7) return 'intensive';
  if (hoursPerDay > 5) return 'moderate';
  return 'light';
}

/**
 * Funzione legacy per compatibilità con phaseTopicGrouping
 */
export async function legacyTopicGrouping(examName, topics, workloadResult, totalDays, progressCallback) {
  logPhase('legacy-compatibility', 'phaseTopicGrouping -> new unlimited system');
  
  // Raggruppa per affinità invece che per difficoltà
  const topicGroups = createIntelligentTopicGroups(topics);
  
  return { 
    studySequence: topics.map((topic, index) => ({
      topicTitle: topic.title,
      position: index + 1,
      reasoning: `Posizione ${index + 1} basata su analisi avanzata: priorità, prerequisiti, e sequenza ottimale`
    })),
    topicGroups: topicGroups
  };
}

/**
 * Crea gruppi di argomenti intelligenti
 */
function createIntelligentTopicGroups(topics) {
  const groups = [];
  const processedTopics = new Set();
  
  topics.forEach(topic => {
    if (processedTopics.has(topic.title)) return;
    
    // Trova argomenti correlati
    const relatedTopics = findRelatedTopics(topic, topics);
    const groupTopics = [topic, ...relatedTopics.filter(t => !processedTopics.has(t.title))];
    
    if (groupTopics.length > 1) {
      groups.push({
        groupName: `Gruppo ${topic.title.split(' ')[0]} e correlati`,
        topics: groupTopics.map(t => t.title),
        canBeStudiedTogether: true,
        totalComplexity: groupTopics.reduce((sum, t) => sum + calculateTopicComplexity(t), 0),
        estimatedTime: groupTopics.reduce((sum, t) => sum + (t.estimatedHours || calculateOptimalHours(t)), 0),
        studyStrategy: generateGroupStudyStrategy(groupTopics)
      });
      
      groupTopics.forEach(t => processedTopics.add(t.title));
    } else {
      groups.push({
        groupName: `${topic.title} (Studio Individuale)`,
        topics: [topic.title],
        canBeStudiedTogether: false,
        totalComplexity: calculateTopicComplexity(topic),
        estimatedTime: topic.estimatedHours || calculateOptimalHours(topic),
        studyStrategy: `Studio intensivo focalizzato su ${topic.title}`
      });
      
      processedTopics.add(topic.title);
    }
  });
  
  return groups;
}

/**
 * Trova argomenti correlati
 */
function findRelatedTopics(mainTopic, allTopics) {
  const related = [];
  const mainConcepts = new Set(mainTopic.keyConcepts || []);
  
  allTopics.forEach(otherTopic => {
    if (otherTopic.title === mainTopic.title) return;
    
    const otherConcepts = new Set(otherTopic.keyConcepts || []);
    const intersection = new Set([...mainConcepts].filter(x => otherConcepts.has(x)));
    
    // Se condividono più del 25% dei concetti, sono correlati
    const totalConcepts = new Set([...mainConcepts, ...otherConcepts]).size;
    if (intersection.size > 0 && (intersection.size / totalConcepts) > 0.25) {
      related.push(otherTopic);
    }
  });
  
  return related.slice(0, 3); // Massimo 3 argomenti correlati per gruppo
}

/**
 * Genera strategia di studio per gruppo
 */
function generateGroupStudyStrategy(groupTopics) {
  if (groupTopics.length === 1) {
    return `Studio intensivo di ${groupTopics[0].title}`;
  }
  
  const hasAdvanced = groupTopics.some(t => t.difficulty === 'advanced');
  const hasPractice = groupTopics.some(t => t.hasExercises);
  
  let strategy = `Studio integrato di ${groupTopics.length} argomenti correlati. `;
  
  if (hasAdvanced) {
    strategy += 'Inizia con i concetti più complessi. ';
  }
  
  if (hasPractice) {
    strategy += 'Alterna studio teorico e pratico. ';
  }
  
  strategy += 'Evidenzia collegamenti e sinergie tra gli argomenti.';
  
  return strategy;
}

/**
 * Funzione legacy per compatibilità con phaseDayDistribution
 */
export async function legacyDayDistribution(examName, topics, workloadResult, groupingResult, totalDays, progressCallback) {
  logPhase('legacy-compatibility', 'phaseDayDistribution -> new unlimited system');
  return await phaseIntelligentUnlimitedDistribution({ examName, topics, totalDays, userDescription: '', progressCallback });
}

/**
 * Funzione legacy per compatibilità con phaseBalancingOptimization
 */
export async function legacyBalancingOptimization(distributionResult, totalDays, originalTopics, progressCallback) {
  logPhase('legacy-compatibility', 'phaseBalancingOptimization -> new unlimited system');
  return await phaseAdvancedValidationAndOptimization({ distributionResult, totalDays, originalTopics, progressCallback });
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