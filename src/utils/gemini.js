// src/utils/gemini.js - Entry Point Aggiornato per Nuova Architettura
// Re-exports from the modular architecture (updated version)

// ===== IMPORT FROM MODULES =====
import { 
  generateCompleteStudyPlan,
  generateCompleteStudyPlanLocal, // NUOVA FUNZIONE OTTIMIZZATA
  generateContentIndex,
  distributeTopicsToDays,
  analyzeContentStructure,
  distributeTopicsOptimized,
  analyzeContentMultiPhase,
  distributeTopicsMultiPhaseAdvanced,
  GeminiUtils,
  LegacyCompatibility
} from './gemini/geminiOrchestrator.js';

import { 
  CONFIG,
  generateFileHash,
  generatePhaseHash,
  cleanupCache,
  fileToGenerativePart,
  prepareFilesForAI,
  executeAIPhase,
  getCacheStats,
  clearAllCaches,
  extractTextFromFilesForAI // NUOVO: per modalità text
} from './gemini/geminiCore.js';

// ===== IMPORT NUOVE FASI AGGIORNATE =====
import {
  phaseIndexSearch,
  phaseIndexValidation,
  phasePageByPageAnalysis,
  phaseTopicGrouping as phaseTopicGroupingNew,
  phaseTopicValidation,
  analyzeContentStructureMultiPhase
} from './gemini/contentAnalysisPhases.js';

import {
  phaseEquitableDistribution,
  phaseDistributionValidation,
  distributeTopicsMultiPhase,
  // Legacy functions (redirected to new system)
  phaseWorkloadAnalysis,
  phaseTopicGrouping,
  phaseDayDistribution,
  phaseBalancingOptimization
} from './gemini/distributionPhases.js';

// ===== MAIN EXPORTS (Compatibilità totale + nuova funzione) =====

// Funzione principale per CreateProject (originale)
export { generateCompleteStudyPlan };

// NUOVA funzione principale ottimizzata (analisi locale)
export { generateCompleteStudyPlanLocal };

// Funzioni legacy
export { 
  generateContentIndex,
  distributeTopicsToDays,
  analyzeContentStructure,
  distributeTopicsOptimized
};

// ===== NUOVE FUNZIONI MULTI-FASE =====

export { 
  analyzeContentMultiPhase,
  distributeTopicsMultiPhaseAdvanced,
  analyzeContentStructureMultiPhase,
  distributeTopicsMultiPhase
};

// ===== CORE UTILITIES =====

export {
  CONFIG,
  generateFileHash,
  generatePhaseHash,
  cleanupCache,
  fileToGenerativePart,
  prepareFilesForAI,
  executeAIPhase,
  getCacheStats,
  clearAllCaches
};

// ===== FASI INDIVIDUALI AGGIORNATE =====

// Fasi analisi contenuti (NUOVE)
export {
  phaseIndexSearch,
  phaseIndexValidation,
  phasePageByPageAnalysis,
  phaseTopicGroupingNew as phaseTopicExtractionNew, // Alias per compatibilità
  phaseTopicValidation
};

// Fasi distribuzione (NUOVE + Legacy Compatibility)
export {
  phaseEquitableDistribution,
  phaseDistributionValidation,
  // Legacy functions (mantengono nomi originali ma usano nuovo sistema)
  phaseWorkloadAnalysis,
  phaseTopicGrouping,
  phaseDayDistribution,
  phaseBalancingOptimization
};

// ===== UTILITÀ =====

export { GeminiUtils, LegacyCompatibility };

// Configurazione
export { CONFIG as GeminiMultiPhaseConfig };

// ===== EXPORT DEFAULT (uso semplificato con nuova funzione) =====

export default {
  // Funzioni principali
  generateCompleteStudyPlan, // Originale (con caricamento Drive)
  generateCompleteStudyPlanLocal, // NUOVA (analisi locale veloce)
  analyzeContentMultiPhase,
  distributeTopicsMultiPhase,
  
  // Legacy (compatibilità)
  generateContentIndex,
  distributeTopicsToDays,
  analyzeContentStructure,
  distributeTopicsOptimized,
  
  // Utilità
  CONFIG,
  GeminiUtils,
  
  // Fasi aggiornate (per uso avanzato)
  phases: {
    content: {
      indexSearch: phaseIndexSearch,
      indexValidation: phaseIndexValidation,
      pageAnalysis: phasePageByPageAnalysis,
      topicGrouping: phaseTopicGroupingNew,
      validation: phaseTopicValidation
    },
    distribution: {
      equitable: phaseEquitableDistribution,
      validation: phaseDistributionValidation,
      // Legacy (per compatibilità)
      workload: phaseWorkloadAnalysis,
      grouping: phaseTopicGrouping,
      dayDistribution: phaseDayDistribution,
      balancing: phaseBalancingOptimization
    }
  }
};

// ===== INFO ARCHITETTURA AGGIORNATA =====

/**
 * ARCHITETTURA MODULARE GEMINI AI (VERSIONE 2.0)
 * 
 * NOVITÀ - NUOVA ARCHITETTURA 5+1 FASI:
 * 
 * ANALISI CONTENUTI (5 fasi ottimizzate):
 * 1. Index Search - Cerca indice/sommario nei PDF
 * 2. Index Validation - Valida indice o crea struttura base
 * 3. Page Analysis - Analizza pagina per pagina
 * 4. Topic Grouping - Raggruppa pagine in argomenti
 * 5. Topic Validation - Valida e corregge argomenti
 * 
 * DISTRIBUZIONE (1 fase semplificata):
 * 1. Equitable Distribution - Distribuisce equamente + validazione
 * 
 * VANTAGGI:
 * ✅ Meno chiamate AI ripetitive (da 9 a 6 fasi)
 * ✅ Uso intelligente dell'indice come guida
 * ✅ Analisi pagina per pagina più precisa
 * ✅ Distribuzione semplificata ed efficace
 * ✅ Compatibilità 100% con codice esistente
 * 
 * WORKFLOW OTTIMIZZATO:
 * 
 * 1. FASE ANALISI (Locale - 5 fasi):
 *    - CreateProject chiama generateCompleteStudyPlanLocal()
 *    - Nuova architettura 5 fasi per analisi contenuti
 *    - 1 fase per distribuzione equa
 * 
 * 2. FASE REVISIONE (Interattiva):
 *    - PlanReviewModal mostra risultati AI
 *    - Utente trascina argomenti tra giorni
 *    - Utente seleziona pagine specifiche
 * 
 * 3. FASE FINALIZZAZIONE (Solo chunks):
 *    - Caricamento Drive solo dei chunks necessari
 *    - Salvataggio Firebase ottimizzato
 * 
 * UTILIZZO:
 * 
 * // Analisi locale (nuova architettura)
 * import { generateCompleteStudyPlanLocal } from './utils/gemini';
 * const plan = await generateCompleteStudyPlanLocal(exam, days, files, desc, callback, mode);
 * 
 * // Fasi individuali (per debugging)
 * import { phaseIndexSearch, phaseEquitableDistribution } from './utils/gemini';
 * 
 * // Legacy (mantenuto per compatibilità)
 * import { generateCompleteStudyPlan } from './utils/gemini';
 */

console.log('Gemini AI: Updated architecture v2.0 loaded');
console.log('- Content phases: 5 (optimized) | Distribution phases: 1 (simplified)');
console.log('- Legacy compatibility: 100% | Cache: Optimized');
console.log('- NEW: Index-guided analysis + Page-by-page processing');