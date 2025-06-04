// src/utils/gemini/geminiMainOrchestrator.js - ORCHESTRATORE PRINCIPALE COMPLETAMENTE MODULARE

import { analyzeContent } from './modules/contentAnalysisModule.js';
import { distributeTopics } from './modules/distributionModule.js';
import { 
  createContentPhaseInput, 
  createDistributionPhaseInput,
  validatePhaseInput,
  logPhase,
  createPhaseError,
  createTimer,
  clearAllCaches,
  getCacheStats
} from './shared/geminiShared.js';

// ===== INPUT/OUTPUT INTERFACES =====

/**
 * @typedef {Object} StudyPlanInput
 * @property {string} examName - Nome dell'esame
 * @property {number} totalDays - Numero totale di giorni
 * @property {Array} files - Array di file PDF
 * @property {string} userDescription - Descrizione utente (opzionale)
 * @property {function} progressCallback - Callback per progress (opzionale)
 * @property {string} analysisMode - 'pdf' o 'text'
 */

/**
 * @typedef {Object} StudyPlanOutput
 * @property {Array} index - Lista degli argomenti estratti
 * @property {Array} distribution - Piano giornaliero
 * @property {Object} statistics - Statistiche complete
 * @property {Object} metadata - Metadati dell'operazione
 * @property {boolean} success - Successo dell'operazione
 */

// ===== ORCHESTRATORE PRINCIPALE =====

/**
 * Genera un piano di studio completo (VERSIONE OTTIMIZZATA LOCALE)
 * INPUT: StudyPlanInput
 * OUTPUT: StudyPlanOutput
 */
export async function generateCompleteStudyPlanLocal(
  examName, 
  totalDays, 
  files, 
  userDescription = "", 
  progressCallback = null,
  analysisMode = 'pdf'
) {
  const timer = createTimer('study-plan-generation');
  
  logPhase('orchestrator', 'INIZIO ORCHESTRAZIONE GEMINI AI');
  logPhase('orchestrator', `📚 Esame: "${examName}" | 🗓️ Giorni: ${totalDays} | 🔧 Modalità: ${analysisMode.toUpperCase()}`);
  logPhase('orchestrator', `📁 File: ${files?.length || 0} | 📝 Note: ${userDescription || 'Nessuna'}`);
  
  try {
    // Validazione parametri principali
    validateStudyPlanInput(examName, totalDays, files, analysisMode);
    
    // Simula le drive info per compatibilità con il sistema esistente
    const mockDriveInfo = files.map((file, index) => ({
      name: file.name,
      originalFileIndex: index,
      driveFileId: null,
      webViewLink: null,
      size: file.size,
      type: file.type
    }));

    // ===== FASE 1: ANALISI CONTENUTI =====
    progressCallback?.({ type: 'processing', message: `AI - Analisi contenuti (${analysisMode === 'pdf' ? 'PDF completo' : 'solo testo'})...` });
    
    logPhase('orchestrator', `🚀 Avvio analisi contenuti (${analysisMode})...`);
    
    const contentInput = createContentPhaseInput(examName, files, userDescription, analysisMode, {
      totalDays: totalDays
    });
    
    const contentResult = await analyzeContent(contentInput);
    
    if (!contentResult.success || !contentResult.data.topics || contentResult.data.topics.length === 0) {
      throw createPhaseError('orchestrator', "AI non ha generato argomenti dai PDF. Verifica che i file contengano contenuto leggibile.");
    }
    
    const contentIndex = contentResult.data.topics;
    
    logPhase('orchestrator', `✅ Analisi contenuti: ${contentIndex.length} argomenti generati`);
    progressCallback?.({ type: 'processing', message: `Analisi contenuti completata (${analysisMode}).` });

    // ===== FASE 2: DISTRIBUZIONE ARGOMENTI =====
    progressCallback?.({ type: 'processing', message: 'AI - Distribuzione argomenti...' });
    
    logPhase('orchestrator', `🚀 Avvio distribuzione...`);
    
    const distributionInput = createDistributionPhaseInput(examName, contentIndex, totalDays, userDescription, {
      analysisMode: analysisMode
    });
    
    const distributionResult = await distributeTopics(distributionInput);
    
    if (!distributionResult.success || !distributionResult.data.dailyPlan || distributionResult.data.dailyPlan.length === 0) {
      throw createPhaseError('orchestrator', "AI non ha generato distribuzione giornaliera valida.");
    }

    logPhase('orchestrator', `✅ Distribuzione: ${distributionResult.data.dailyPlan.length} giorni pianificati`);
    progressCallback?.({ type: 'processing', message: 'Distribuzione completata.' });

    // ===== COSTRUZIONE OUTPUT FINALE =====
    const duration = timer.elapsed();
    
    const completePlan = {
      // Dati principali (formato compatibile con sistema esistente)
      index: contentIndex,
      distribution: distributionResult.data.dailyPlan,
      
      // Metadati per compatibilità
      pageMapping: {}, // Non più necessario con la nuova architettura
      originalFilesInfo: mockDriveInfo, // Info simulate per compatibilità
      
      // Dati per la successiva fase di caricamento Drive
      localFiles: files, // File objects originali
      analysisMode: analysisMode, // Modalità utilizzata
      
      // Statistiche complete e risultati dettagliati
      statistics: {
        content: contentResult.data.statistics,
        distribution: distributionResult.data.statistics,
        performance: {
          totalDuration: duration,
          analysisMode: analysisMode,
          filesProcessed: files.length,
          topicsGenerated: contentIndex.length,
          daysPlanned: distributionResult.data.dailyPlan.length
        }
      },
      
      // Risultati delle fasi per debugging
      multiPhaseResults: {
        contentAnalysis: contentResult.data.phaseResults,
        distribution: distributionResult.data.phaseResults,
        metadata: {
          version: '2.0',
          architecture: 'modular',
          timestamp: Date.now(),
          cacheStats: getCacheStats()
        }
      },
      
      // Flag di successo
      success: true
    };

    timer.log(`ORCHESTRAZIONE COMPLETATA`);
    logPhase('orchestrator', `🎉 RISULTATO: ${contentIndex.length} argomenti, ${distributionResult.data.dailyPlan.length} giorni`);
    
    progressCallback?.({ type: 'processing', message: `Analisi locale completata (${analysisMode})!` });
    
    return completePlan;

  } catch (error) {
    const duration = timer.elapsed();
    logPhase('orchestrator', `❌ ORCHESTRAZIONE FALLITA dopo ${duration}ms: ${error.message}`);
    throw createPhaseError('orchestrator', `Errore analisi locale (${analysisMode}): ${error.message}`, error);
  }
}

// ===== FUNZIONI LEGACY PER COMPATIBILITÀ =====

/**
 * Funzione legacy per compatibilità totale con il sistema esistente
 * DEPRECATA - usa generateCompleteStudyPlanLocal
 */
export async function generateCompleteStudyPlan(
  examName, 
  totalDays, 
  files, 
  originalFilesDriveInfo, 
  userDescription = "", 
  progressCallback = null
) {
  logPhase('legacy-compatibility', '⚠️ USANDO FUNZIONE LEGACY generateCompleteStudyPlan');
  logPhase('legacy-compatibility', '💡 Consiglio: usa generateCompleteStudyPlanLocal');
  
  try {
    // Usa la nuova funzione ottimizzata
    const result = await generateCompleteStudyPlanLocal(
      examName,
      totalDays,
      files,
      userDescription,
      progressCallback,
      'pdf' // Modalità PDF per compatibilità
    );
    
    // Adatta l'output al formato legacy
    return {
      index: result.index,
      distribution: result.distribution,
      pageMapping: result.pageMapping,
      originalFilesInfo: originalFilesDriveInfo, // Usa i dati originali se forniti
      multiPhaseResults: result.multiPhaseResults
    };

  } catch (error) {
    logPhase('legacy-compatibility', `❌ LEGACY FALLITA: ${error.message}`);
    throw createPhaseError('legacy-orchestrator', `Errore AI: ${error.message}`, error);
  }
}

/**
 * Accesso diretto al modulo di analisi contenuti
 */
export async function analyzeContentStructureMultiPhase(examName, filesArray, originalFilesDriveInfo, userDescription = "", progressCallback, analysisMode = 'pdf') {
  logPhase('direct-access', `Direct access: analyzeContentStructureMultiPhase (${analysisMode})`);
  
  const input = createContentPhaseInput(examName, filesArray, userDescription, analysisMode);
  const result = await analyzeContent(input);
  
  // Formato compatibile con il sistema esistente
  return {
    tableOfContents: result.data.topics,
    pageMapping: {}, // Non più necessario
    phaseResults: result.data.phaseResults,
    statistics: result.data.statistics
  };
}

/**
 * Accesso diretto al modulo di distribuzione
 */
export async function distributeTopicsMultiPhase(examName, totalDays, topics, userDescription = "", progressCallback) {
  logPhase('direct-access', `Direct access: distributeTopicsMultiPhase`);
  
  const input = createDistributionPhaseInput(examName, topics, totalDays, userDescription);
  const result = await distributeTopics(input);
  
  // Formato compatibile con il sistema esistente
  return {
    dailyPlan: result.data.dailyPlan,
    statistics: result.data.statistics,
    phaseResults: result.data.phaseResults
  };
}

// ===== UTILITY FUNCTIONS =====

/**
 * Valida i parametri di input per la generazione del piano di studio
 */
function validateStudyPlanInput(examName, totalDays, files, analysisMode) {
  const errors = [];
  
  if (!examName || typeof examName !== 'string' || examName.trim().length === 0) {
    errors.push('examName deve essere una stringa non vuota');
  }
  
  if (!totalDays || typeof totalDays !== 'number' || totalDays < 1 || totalDays > 365) {
    errors.push('totalDays deve essere un numero tra 1 e 365');
  }
  
  if (!files || !Array.isArray(files) || files.length === 0) {
    errors.push('files deve essere un array non vuoto');
  }
  
  if (!['pdf', 'text'].includes(analysisMode)) {
    errors.push('analysisMode deve essere "pdf" o "text"');
  }
  
  // Verifica che i file siano validi
  if (files && Array.isArray(files)) {
    files.forEach((file, index) => {
      if (!file || !(file instanceof File)) {
        errors.push(`File ${index} non è un oggetto File valido`);
      } else if (file.type !== 'application/pdf') {
        errors.push(`File ${index} (${file.name}) non è un PDF`);
      }
    });
  }
  
  if (errors.length > 0) {
    throw createPhaseError('input-validation', `Validazione input fallita: ${errors.join(', ')}`);
  }
  
  return true;
}

/**
 * Utility per creare input standardizzato
 */
export function createStudyPlanInput(examName, totalDays, files, userDescription = '', analysisMode = 'pdf', progressCallback = null) {
  return {
    examName: examName.trim(),
    totalDays: parseInt(totalDays) || 7,
    files: Array.isArray(files) ? files : [],
    userDescription: userDescription.trim(),
    analysisMode: ['pdf', 'text'].includes(analysisMode) ? analysisMode : 'pdf',
    progressCallback: progressCallback,
    timestamp: Date.now()
  };
}

// ===== UTILITÀ DI SISTEMA =====

/**
 * Informazioni sulla versione e configurazione del sistema
 */
export function getSystemInfo() {
  return {
    version: '2.0',
    architecture: 'modular',
    modules: {
      contentAnalysis: 'contentAnalysisModule',
      distribution: 'distributionModule',
      aiService: 'geminiAIService',
      shared: 'geminiShared'
    },
    features: {
      analysisMode: ['pdf', 'text'],
      caching: true,
      validation: true,
      errorHandling: true,
      legacyCompatibility: true
    },
    cacheStats: getCacheStats(),
    timestamp: Date.now()
  };
}

/**
 * Pulizia completa del sistema
 */
export function cleanupSystem() {
  const clearedCount = clearAllCaches();
  logPhase('system-cleanup', `Sistema pulito: ${clearedCount} elementi cache rimossi`);
  return {
    cacheCleared: clearedCount,
    timestamp: Date.now()
  };
}

// ===== COMPATIBILITY LAYER =====

/**
 * Layer di compatibilità per le funzioni legacy del sistema esistente
 */
export const LegacyCompatibility = {
  // Analisi contenuti legacy
  generateContentIndex: async (examName, filesArray, originalFilesDriveInfo, userDescription = "") => {
    logPhase('legacy-compatibility', '⚠️ LEGACY: generateContentIndex -> analyzeContentStructureMultiPhase');
    const result = await analyzeContentStructureMultiPhase(examName, filesArray, originalFilesDriveInfo, userDescription, null, 'pdf');
    return {
      tableOfContents: result.tableOfContents,
      pageMapping: result.pageMapping
    };
  },
  
  // Distribuzione legacy
  distributeTopicsToDays: async (examName, totalDays, topics, userDescription = "") => {
    logPhase('legacy-compatibility', '⚠️ LEGACY: distributeTopicsToDays -> distributeTopicsMultiPhase');
    const result = await distributeTopicsMultiPhase(examName, totalDays, topics, userDescription);
    return {
      dailyPlan: result.dailyPlan
    };
  },
  
  // Analisi struttura legacy
  analyzeContentStructure: async (examName, filesArray, originalFilesDriveInfo, userDescription = "", progressCallback) => {
    logPhase('legacy-compatibility', '⚠️ LEGACY: analyzeContentStructure -> analyzeContentStructureMultiPhase');
    const result = await analyzeContentStructureMultiPhase(examName, filesArray, originalFilesDriveInfo, userDescription, progressCallback, 'pdf');
    return {
      tableOfContents: result.tableOfContents,
      pageMapping: result.pageMapping
    };
  },
  
  // Distribuzione ottimizzata legacy
  distributeTopicsOptimized: async (examName, totalDays, topics, userDescription = "", progressCallback) => {
    logPhase('legacy-compatibility', '⚠️ LEGACY: distributeTopicsOptimized -> distributeTopicsMultiPhase');
    const result = await distributeTopicsMultiPhase(examName, totalDays, topics, userDescription, progressCallback);
    return {
      dailyPlan: result.dailyPlan
    };
  }
};

// ===== UTILITÀ AVANZATE =====

/**
 * Utilità per il sistema Gemini
 */
export const GeminiUtils = {
  // Cache management
  clearAllCaches: () => {
    const clearedCount = clearAllCaches();
    logPhase('utils', `🗑️ Cache pulite: ${clearedCount} elementi`);
    return clearedCount;
  },
  
  getCacheStats: () => {
    const stats = getCacheStats();
    return {
      ...stats,
      timestamp: Date.now()
    };
  },
  
  // System info
  getSystemInfo: getSystemInfo,
  cleanupSystem: cleanupSystem,
  
  // Diagnostica
  logSystemInfo: () => {
    const info = getSystemInfo();
    logPhase('diagnostics', '📊 GEMINI SYSTEM INFO');
    logPhase('diagnostics', `⚙️ Versione: ${info.version}`);
    logPhase('diagnostics', `🏗️ Architettura: ${info.architecture}`);
    logPhase('diagnostics', `💾 Cache:`, info.cacheStats);
    logPhase('diagnostics', `🔧 Modalità supportate: ${info.features.analysisMode.join(', ')}`);
    return info;
  },
  
  // Performance testing
  benchmarkAnalysis: async (examName, files, analysisMode = 'pdf') => {
    const timer = createTimer('benchmark');
    
    try {
      logPhase('benchmark', `🏃 Avvio benchmark (${analysisMode})`);
      
      const result = await generateCompleteStudyPlanLocal(
        examName,
        7, // 7 giorni standard per benchmark
        files,
        'Benchmark test',
        null,
        analysisMode
      );
      
      const duration = timer.elapsed();
      const stats = {
        duration: duration,
        analysisMode: analysisMode,
        filesCount: files.length,
        totalFileSize: files.reduce((sum, f) => sum + f.size, 0),
        topicsGenerated: result.index.length,
        avgTimePerTopic: Math.round(duration / result.index.length),
        avgTimePerFile: Math.round(duration / files.length),
        success: true
      };
      
      logPhase('benchmark', `✅ Benchmark completato in ${duration}ms`);
      logPhase('benchmark', `📊 ${stats.topicsGenerated} argomenti da ${stats.filesCount} file`);
      
      return stats;
      
    } catch (error) {
      const duration = timer.elapsed();
      logPhase('benchmark', `❌ Benchmark fallito dopo ${duration}ms: ${error.message}`);
      
      return {
        duration: duration,
        analysisMode: analysisMode,
        filesCount: files.length,
        error: error.message,
        success: false
      };
    }
  }
};

// ===== EXPORT DEFAULT =====
export default {
  // Funzioni principali
  generateCompleteStudyPlan, // Legacy (DEPRECATA)
  generateCompleteStudyPlanLocal, // NUOVA FUNZIONE PRINCIPALE ⭐
  
  // Accesso diretto ai moduli
  analyzeContentStructureMultiPhase,
  distributeTopicsMultiPhase,
  
  // Utility e supporto
  createStudyPlanInput,
  getSystemInfo,
  cleanupSystem,
  
  // Compatibilità legacy
  LegacyCompatibility,
  GeminiUtils,
  
  // Re-export delle funzioni legacy per compatibilità totale
  generateContentIndex: LegacyCompatibility.generateContentIndex,
  distributeTopicsToDays: LegacyCompatibility.distributeTopicsToDays,
  analyzeContentStructure: LegacyCompatibility.analyzeContentStructure,
  distributeTopicsOptimized: LegacyCompatibility.distributeTopicsOptimized
};

// ===== LOGGING SISTEMA =====
logPhase('system-init', `🎯 GEMINI MAIN ORCHESTRATOR v2.0 CARICATO`);
logPhase('system-init', `🚀 FUNZIONE PRINCIPALE: generateCompleteStudyPlanLocal()`);
logPhase('system-init', `📊 ARCHITETTURA: Modulare indipendente - 4 moduli principali`);
logPhase('system-init', `🔧 MODALITÀ: PDF (completa), TEXT (veloce)`);
logPhase('system-init', `✅ COMPATIBILITÀ: 100% con sistema esistente`);