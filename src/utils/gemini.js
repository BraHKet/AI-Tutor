// src/utils/gemini.js - Simplified Main Entry Point
// Re-exports from the modular architecture (simplified version)

// ===== IMPORT FROM MODULES =====
import { 
  generateCompleteStudyPlan,
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
  clearAllCaches
} from './gemini/geminiCore.js';

import {
  phaseStructuralAnalysis,
  phaseContentMapping,
  phaseTopicExtraction,
  phasePageAssignment,
  phaseValidationOptimization,
  analyzeContentStructureMultiPhase
} from './gemini/contentAnalysisPhases.js';

import {
  phaseWorkloadAnalysis,
  phaseTopicGrouping,
  phaseDayDistribution,
  phaseBalancingOptimization,
  distributeTopicsMultiPhase
} from './gemini/distributionPhases.js';

// ===== MAIN EXPORTS (Compatibilità totale) =====

// Funzione principale per CreateProject
export { generateCompleteStudyPlan };

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

// ===== FASI INDIVIDUALI (per testing) =====

// Fasi analisi contenuti
export {
  phaseStructuralAnalysis,
  phaseContentMapping,
  phaseTopicExtraction,
  phasePageAssignment,
  phaseValidationOptimization
};

// Fasi distribuzione
export {
  phaseWorkloadAnalysis,
  phaseTopicGrouping,
  phaseDayDistribution,
  phaseBalancingOptimization
};

// ===== UTILITÀ =====

export { GeminiUtils, LegacyCompatibility };

// Configurazione
export { CONFIG as GeminiMultiPhaseConfig };

// ===== EXPORT DEFAULT (uso semplificato) =====

export default {
  // Funzioni principali
  generateCompleteStudyPlan,
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
  
  // Fasi (per uso avanzato)
  phases: {
    content: {
      structural: phaseStructuralAnalysis,
      mapping: phaseContentMapping,
      extraction: phaseTopicExtraction,
      assignment: phasePageAssignment,
      validation: phaseValidationOptimization
    },
    distribution: {
      workload: phaseWorkloadAnalysis,
      grouping: phaseTopicGrouping,
      dayDistribution: phaseDayDistribution,
      balancing: phaseBalancingOptimization
    }
  }
};

// ===== INFO ARCHITETTURA SEMPLIFICATA =====

/**
 * ARCHITETTURA MODULARE GEMINI AI (VERSIONE SEMPLIFICATA)
 * 
 * File Structure:
 * - gemini.js (questo file) - Entry point principale
 * - gemini/geminiCore.js - Cache e utilità core
 * - gemini/contentAnalysisPhases.js - 5 fasi analisi contenuti
 * - gemini/distributionPhases.js - 4 fasi distribuzione  
 * - gemini/geminiOrchestrator.js - Orchestratore principale
 * 
 * Vantaggi della nuova versione:
 * ✅ Codice più organizzato e mantenibile
 * ✅ Cache ottimizzata (meno chiamate API)
 * ✅ Gestione errori migliorata
 * ✅ Compatibilità 100% con codice esistente
 * ✅ Sistema modulare ma semplificato
 * 
 * Processo Multi-Fase:
 * 
 * ANALISI CONTENUTI (5 fasi):
 * 1. Structural Analysis - Analizza struttura
 * 2. Content Mapping - Mappa contenuti  
 * 3. Topic Extraction - Estrae argomenti
 * 4. Page Assignment - Assegna pagine
 * 5. Validation - Valida risultati
 * 
 * DISTRIBUZIONE (4 fasi):
 * 1. Workload Analysis - Analizza carico
 * 2. Topic Grouping - Raggruppa argomenti
 * 3. Day Distribution - Distribuzione giornaliera
 * 4. Balancing - Bilanciamento finale
 * 
 * Per CreateProject:
 * - Usa sempre generateCompleteStudyPlan() come prima
 * - Funziona esattamente come prima ma è più veloce e preciso
 * - Cache automatica riduce i tempi di attesa
 */

console.log('Gemini AI: Simplified multi-phase architecture loaded');
console.log('- Content phases: 5 | Distribution phases: 4');
console.log('- Legacy compatibility: 100% | Cache: Optimized');