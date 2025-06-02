// src/utils/gemini/geminiOrchestrator.js - Simplified Main Orchestrator
import { analyzeContentStructureMultiPhase } from './contentAnalysisPhases.js';
import { distributeTopicsMultiPhase } from './distributionPhases.js';
import { CONFIG, clearAllCaches, getCacheStats } from './geminiCore.js';

// ===== ORCHESTRATORE PRINCIPALE =====

/**
 * Funzione principale per la generazione del piano di studio completo
 * Interfaccia immutata per compatibilità con CreateProject
 */
export const generateCompleteStudyPlan = async (
  examName, 
  totalDays, 
  files, 
  originalFilesDriveInfo, 
  userDescription = "", 
  progressCallback = null
) => {
  console.log('GeminiOrchestrator: Starting multi-phase AI analysis');
  
  try {
    // ANALISI CONTENUTI (5 fasi)
    progressCallback?.({ type: 'processing', message: 'AI - Analisi contenuti...' });
    
    const aiIndexResult = await analyzeContentStructureMultiPhase(
      examName,
      files,
      originalFilesDriveInfo,
      userDescription,
      progressCallback
    );

    const contentIndex = aiIndexResult.tableOfContents;
    const pageMapping = aiIndexResult.pageMapping || {};

    if (!contentIndex || contentIndex.length === 0) {
      throw new Error("AI non ha generato argomenti dai PDF.");
    }
    
    progressCallback?.({ type: 'processing', message: 'Analisi contenuti completata.' });

    // DISTRIBUZIONE (4 fasi)
    progressCallback?.({ type: 'processing', message: 'AI - Distribuzione argomenti...' });
    
    const topicDistribution = await distributeTopicsMultiPhase(
      examName, 
      totalDays, 
      contentIndex, 
      userDescription,
      progressCallback
    );

    if (!topicDistribution || !topicDistribution.dailyPlan || topicDistribution.dailyPlan.length === 0) {
      throw new Error("AI non ha generato distribuzione giornaliera.");
    }

    progressCallback?.({ type: 'processing', message: 'Distribuzione completata.' });

    // Piano completo (formato compatibile)
    const completePlan = {
      index: contentIndex,
      distribution: topicDistribution.dailyPlan,
      pageMapping: pageMapping,
      originalFilesInfo: originalFilesDriveInfo,
      // Statistiche per debugging
      multiPhaseResults: {
        contentAnalysis: aiIndexResult.phaseResults,
        distribution: topicDistribution.phaseResults,
        statistics: {
          content: aiIndexResult.statistics,
          distribution: topicDistribution.statistics
        }
      }
    };

    console.log('GeminiOrchestrator: Analysis completed successfully');
    return completePlan;

  } catch (error) {
    console.error('GeminiOrchestrator: Error:', error);
    throw new Error(`Errore AI: ${error.message}`);
  }
};

// ===== FUNZIONI LEGACY (compatibilità) =====

export const generateContentIndex = async (examName, filesArray, originalFilesDriveInfo, userDescription = "") => {
  console.warn('GeminiOrchestrator: Using legacy generateContentIndex');
  const result = await analyzeContentStructureMultiPhase(examName, filesArray, originalFilesDriveInfo, userDescription);
  return {
    tableOfContents: result.tableOfContents,
    pageMapping: result.pageMapping
  };
};

export const distributeTopicsToDays = async (examName, totalDays, topics, userDescription = "") => {
  console.warn('GeminiOrchestrator: Using legacy distributeTopicsToDays');
  const result = await distributeTopicsMultiPhase(examName, totalDays, topics, userDescription);
  return {
    dailyPlan: result.dailyPlan
  };
};

// ===== ACCESSO DIRETTO ALLE FASI =====

export const analyzeContentMultiPhase = async (examName, filesArray, originalFilesDriveInfo, userDescription = "", progressCallback = null) => {
  return await analyzeContentStructureMultiPhase(examName, filesArray, originalFilesDriveInfo, userDescription, progressCallback);
};

export const distributeTopicsMultiPhaseAdvanced = async (examName, totalDays, topics, userDescription = "", progressCallback = null) => {
  return await distributeTopicsMultiPhase(examName, totalDays, topics, userDescription, progressCallback);
};

// ===== UTILITÀ SEMPLIFICATE =====

export const GeminiUtils = {
  // Cache management
  clearAllCaches: () => {
    const clearedCount = clearAllCaches();
    console.log(`GeminiOrchestrator: Cleared ${clearedCount} cache entries`);
    return clearedCount;
  },
  
  getCacheStats: () => {
    const stats = getCacheStats();
    return {
      ...stats,
      maxEntries: CONFIG.CACHE.maxEntries,
      ttlHours: CONFIG.CACHE.ttlHours
    };
  },
  
  // Configurazione
  getConfig: () => ({ ...CONFIG }),
  
  updateConfig: (newConfig) => {
    Object.assign(CONFIG, newConfig);
    console.log('GeminiOrchestrator: Configuration updated');
  }
};

// ===== LAYER COMPATIBILITÀ =====

export const LegacyCompatibility = {
  analyzeContentStructure: async (examName, filesArray, originalFilesDriveInfo, userDescription = "", progressCallback) => {
    console.warn('GeminiOrchestrator: Legacy analyzeContentStructure -> multi-phase');
    const result = await analyzeContentStructureMultiPhase(examName, filesArray, originalFilesDriveInfo, userDescription, progressCallback);
    return {
      tableOfContents: result.tableOfContents,
      pageMapping: result.pageMapping
    };
  },
  
  distributeTopicsOptimized: async (examName, totalDays, topics, userDescription = "", progressCallback) => {
    console.warn('GeminiOrchestrator: Legacy distributeTopicsOptimized -> multi-phase');
    const result = await distributeTopicsMultiPhase(examName, totalDays, topics, userDescription, progressCallback);
    return {
      dailyPlan: result.dailyPlan
    };
  }
};

// Esporta funzioni legacy
export const analyzeContentStructure = LegacyCompatibility.analyzeContentStructure;
export const distributeTopicsOptimized = LegacyCompatibility.distributeTopicsOptimized;

// ===== EXPORT DEFAULT =====

export default {
  // Funzioni principali
  generateCompleteStudyPlan,
  analyzeContentMultiPhase,
  distributeTopicsMultiPhase,
  
  // Legacy
  generateContentIndex,
  distributeTopicsToDays,
  analyzeContentStructure,
  distributeTopicsOptimized,
  
  // Utilità
  GeminiUtils,
  CONFIG,
  
  // Compatibilità
  LegacyCompatibility
};