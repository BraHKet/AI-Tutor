// src/utils/gemini/geminiOrchestrator.js - VERSIONE COMPLETAMENTE INDIPENDENTE
import { analyzeContentStructureMultiPhase } from './contentAnalysisPhases.js';
import { distributeTopicsMultiPhase } from './distributionPhases.js';
import { CONFIG, clearAllCaches, getCacheStats } from './geminiCore.js';

// ===== LOGGING ORCHESTRATORE =====
function logOrchestrationStart(examName, totalDays, files, analysisMode, userDescription) {
  console.log(`\n🎯 ===== AVVIO ORCHESTRAZIONE GEMINI AI =====`);
  console.log(`📚 Esame: "${examName}"`);
  console.log(`🗓️ Giorni totali: ${totalDays}`);
  console.log(`🔧 Modalità analisi: ${analysisMode.toUpperCase()}`);
  console.log(`📁 File caricati: ${files?.length || 0}`);
  if (files && files.length > 0) {
    files.forEach((file, i) => {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      console.log(`  ${i + 1}. ${file.name} (${sizeMB} MB)`);
    });
  }
  console.log(`📝 Descrizione utente: ${userDescription || 'Nessuna'}`);
  console.log(`⚙️ Limiti testo: PDF=${CONFIG.TEXT_LIMITS?.maxCharsForPdf || 50000}, TEXT=${CONFIG.TEXT_LIMITS?.maxCharsForText || 80000}`);
  console.log(`===========================================\n`);
}

function logOrchestrationSuccess(result, analysisMode, duration) {
  console.log(`\n🎉 ===== ORCHESTRAZIONE COMPLETATA =====`);
  console.log(`✅ Modalità: ${analysisMode.toUpperCase()}`);
  console.log(`⏱️ Durata: ${duration}ms`);
  console.log(`📊 Argomenti creati: ${result.index?.length || 0}`);
  console.log(`🗓️ Distribuzione: ${result.distribution?.length || 0} giorni pianificati`);
  
  if (result.index && result.index.length > 0) {
    console.log(`📋 Argomenti principali:`);
    result.index.slice(0, 5).forEach((topic, i) => {
      const pages = topic.totalPages || topic.pages_info?.reduce((sum, p) => sum + (p.end_page - p.start_page + 1), 0) || 0;
      console.log(`  ${i + 1}. "${topic.title}" (${pages} pagine, ${topic.priority || 'N/A'} priority)`);
    });
    if (result.index.length > 5) {
      console.log(`  ... e altri ${result.index.length - 5} argomenti`);
    }
  }
  
  if (result.distribution && result.distribution.length > 0) {
    console.log(`📅 Distribuzione giorni:`);
    result.distribution.slice(0, 7).forEach(day => {
      const topicsCount = day.assignedTopics?.length || 0;
      console.log(`  Giorno ${day.day}: ${topicsCount} argomenti`);
    });
    if (result.distribution.length > 7) {
      console.log(`  ... e altri ${result.distribution.length - 7} giorni`);
    }
  }
  
  if (result.multiPhaseResults) {
    console.log(`🔍 Statistiche fasi:`);
    if (result.multiPhaseResults.statistics?.content) {
      console.log(`  - Analisi contenuti: ${result.multiPhaseResults.statistics.content.totalTopics} argomenti, ${result.multiPhaseResults.statistics.content.totalAssignedPages} pagine`);
    }
    if (result.multiPhaseResults.statistics?.distribution) {
      console.log(`  - Distribuzione: ${result.multiPhaseResults.statistics.distribution.studyDays} studio, ${result.multiPhaseResults.statistics.distribution.reviewDays} ripasso`);
    }
  }
  
  console.log(`======================================\n`);
}

function logOrchestrationError(error, analysisMode, duration) {
  console.error(`\n❌ ===== ORCHESTRAZIONE FALLITA =====`);
  console.error(`🔧 Modalità: ${analysisMode}`);
  console.error(`⏱️ Durata: ${duration}ms`);
  console.error(`💥 Errore:`, error.message);
  console.error(`🔍 Stack:`, error.stack);
  console.error(`===================================\n`);
}

// ===== NUOVA FUNZIONE ANALISI LOCALE OTTIMIZZATA =====

/**
 * VERSIONE OTTIMIZZATA: Analisi completamente locale senza caricamento Drive
 * Supporta modalità PDF (base64) e TEXT (solo testo estratto)
 * COMPLETAMENTE INDIPENDENTE - non dipende da altri moduli
 */
export const generateCompleteStudyPlanLocal = async (
  examName, 
  totalDays, 
  files, // File objects diretti (no drive info)
  userDescription = "", 
  progressCallback = null,
  analysisMode = 'pdf' // NUOVO: 'pdf' o 'text'
) => {
  const startTime = Date.now();
  
  logOrchestrationStart(examName, totalDays, files, analysisMode, userDescription);
  
  try {
    // Validazione parametri
    if (!examName || !totalDays || !files || files.length === 0) {
      throw new Error('Parametri mancanti: examName, totalDays e files sono obbligatori');
    }
    
    if (totalDays < 1 || totalDays > 365) {
      throw new Error('totalDays deve essere tra 1 e 365');
    }
    
    if (!Array.isArray(files)) {
      throw new Error('files deve essere un array');
    }
    
    // Verifica che analysisMode sia valido
    if (!['pdf', 'text'].includes(analysisMode)) {
      console.warn(`Modalità analisi "${analysisMode}" non valida, uso 'pdf'`);
      analysisMode = 'pdf';
    }
    
    console.log(`🔧 Parametri validati - Modalità: ${analysisMode}, Giorni: ${totalDays}, File: ${files.length}`);
    
    // Simula le drive info per compatibilità con le fasi esistenti (SOLO per interfaccia)
    const mockDriveInfo = files.map((file, index) => ({
      name: file.name,
      originalFileIndex: index,
      // Per la fase locale non servono questi campi reali
      driveFileId: null,
      webViewLink: null,
      size: file.size,
      type: file.type
    }));

    console.log(`📋 Drive info simulate create per compatibilità`);

    // ANALISI CONTENUTI (5 fasi) - Locale con modalità selezionata
    progressCallback?.({ type: 'processing', message: `AI - Analisi contenuti (${analysisMode === 'pdf' ? 'PDF completo' : 'solo testo'})...` });
    
    console.log(`🚀 Avvio analisi contenuti multi-fase (${analysisMode})...`);
    
    const aiIndexResult = await analyzeContentStructureMultiPhase(
      examName,
      files, // File objects diretti
      mockDriveInfo, // Info simulate per compatibilità
      userDescription,
      progressCallback,
      analysisMode // NUOVO PARAMETRO
    );

    const contentIndex = aiIndexResult.tableOfContents;

    if (!contentIndex || contentIndex.length === 0) {
      throw new Error("AI non ha generato argomenti dai PDF. Verifica che i file contengano contenuto leggibile.");
    }
    
    console.log(`✅ Analisi contenuti completata: ${contentIndex.length} argomenti generati`);
    progressCallback?.({ type: 'processing', message: `Analisi contenuti completata (${analysisMode}).` });

    // DISTRIBUZIONE (1 fase semplificata)
    progressCallback?.({ type: 'processing', message: 'AI - Distribuzione argomenti...' });
    
    console.log(`🚀 Avvio distribuzione multi-fase...`);
    
    const topicDistribution = await distributeTopicsMultiPhase(
      examName, 
      totalDays, 
      contentIndex, 
      userDescription,
      progressCallback
    );

    if (!topicDistribution || !topicDistribution.dailyPlan || topicDistribution.dailyPlan.length === 0) {
      throw new Error("AI non ha generato distribuzione giornaliera valida.");
    }

    console.log(`✅ Distribuzione completata: ${topicDistribution.dailyPlan.length} giorni pianificati`);
    progressCallback?.({ type: 'processing', message: 'Distribuzione completata.' });

    // Piano completo (formato compatibile) - Senza dati Drive
    const completePlan = {
      index: contentIndex,
      distribution: topicDistribution.dailyPlan,
      pageMapping: {}, // Non necessario per la fase locale
      originalFilesInfo: mockDriveInfo, // Info simulate per compatibilità
      // Dati per la successiva fase di caricamento Drive
      localFiles: files, // File objects originali
      analysisMode: analysisMode, // NUOVO: modalità utilizzata
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

    const duration = Date.now() - startTime;
    logOrchestrationSuccess(completePlan, analysisMode, duration);
    
    progressCallback?.({ type: 'processing', message: `Analisi locale completata (${analysisMode})!` });
    
    return completePlan;

  } catch (error) {
    const duration = Date.now() - startTime;
    logOrchestrationError(error, analysisMode, duration);
    throw new Error(`Errore analisi locale (${analysisMode}): ${error.message}`);
  }
};

// ===== ORCHESTRATORE PRINCIPALE (invariato per compatibilità) =====

/**
 * Funzione principale per la generazione del piano di studio completo
 * Interfaccia immutata per compatibilità con CreateProject
 * NON PIÙ USATA - mantenuta solo per compatibilità legacy
 */
export const generateCompleteStudyPlan = async (
  examName, 
  totalDays, 
  files, 
  originalFilesDriveInfo, 
  userDescription = "", 
  progressCallback = null
) => {
  const startTime = Date.now();
  
  console.log(`\n⚠️ ===== USANDO FUNZIONE LEGACY =====`);
  console.log(`📢 ATTENZIONE: generateCompleteStudyPlan è deprecata`);
  console.log(`💡 Usa invece: generateCompleteStudyPlanLocal`);
  console.log(`=====================================\n`);
  
  logOrchestrationStart(examName, totalDays, files, 'pdf', userDescription);
  
  try {
    // ANALISI CONTENUTI (5 fasi)
    progressCallback?.({ type: 'processing', message: 'AI - Analisi contenuti...' });
    
    const aiIndexResult = await analyzeContentStructureMultiPhase(
      examName,
      files,
      originalFilesDriveInfo,
      userDescription,
      progressCallback,
      'pdf' // Modalità PDF per compatibilità
    );

    const contentIndex = aiIndexResult.tableOfContents;
    const pageMapping = aiIndexResult.pageMapping || {};
    if (!contentIndex || contentIndex.length === 0) {
     throw new Error("AI non ha generato argomenti dai PDF.");
   }
   
   progressCallback?.({ type: 'processing', message: 'Analisi contenuti completata.' });

   // DISTRIBUZIONE (1 fase)
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

   const duration = Date.now() - startTime;
   logOrchestrationSuccess(completePlan, 'pdf', duration);
   
   return completePlan;

 } catch (error) {
   const duration = Date.now() - startTime;
   logOrchestrationError(error, 'pdf', duration);
   throw new Error(`Errore AI: ${error.message}`);
 }
};

// ===== FUNZIONI LEGACY (compatibilità) =====

export const generateContentIndex = async (examName, filesArray, originalFilesDriveInfo, userDescription = "") => {
 console.warn(`\n⚠️ LEGACY: generateContentIndex -> analyzeContentStructureMultiPhase`);
 const result = await analyzeContentStructureMultiPhase(examName, filesArray, originalFilesDriveInfo, userDescription, null, 'pdf');
 return {
   tableOfContents: result.tableOfContents,
   pageMapping: result.pageMapping
 };
};

export const distributeTopicsToDays = async (examName, totalDays, topics, userDescription = "") => {
 console.warn(`\n⚠️ LEGACY: distributeTopicsToDays -> distributeTopicsMultiPhase`);
 const result = await distributeTopicsMultiPhase(examName, totalDays, topics, userDescription);
 return {
   dailyPlan: result.dailyPlan
 };
};

// ===== ACCESSO DIRETTO ALLE FASI =====

export const analyzeContentMultiPhase = async (examName, filesArray, originalFilesDriveInfo, userDescription = "", progressCallback = null, analysisMode = 'pdf') => {
 console.log(`\n🔧 Direct phase access: analyzeContentMultiPhase (${analysisMode})`);
 return await analyzeContentStructureMultiPhase(examName, filesArray, originalFilesDriveInfo, userDescription, progressCallback, analysisMode);
};

export const distributeTopicsMultiPhaseAdvanced = async (examName, totalDays, topics, userDescription = "", progressCallback = null) => {
 console.log(`\n🔧 Direct phase access: distributeTopicsMultiPhaseAdvanced`);
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
     maxEntries: CONFIG.CACHE?.maxEntries || 50,
     ttlHours: CONFIG.CACHE?.ttlHours || 24
   };
 },
 
 // Configurazione
 getConfig: () => ({ ...CONFIG }),
 
 updateConfig: (newConfig) => {
   Object.assign(CONFIG, newConfig);
   console.log('GeminiOrchestrator: Configuration updated', newConfig);
 },
 
 // Diagnostica
 logSystemInfo: () => {
   console.log(`\n📊 ===== GEMINI SYSTEM INFO =====`);
   console.log(`⚙️ Config:`, CONFIG);
   console.log(`💾 Cache:`, GeminiUtils.getCacheStats());
   console.log(`🔧 Modalità supportate: PDF (completa), TEXT (veloce)`);
   console.log(`📈 Limiti testo: PDF=${CONFIG.TEXT_LIMITS?.maxCharsForPdf}, TEXT=${CONFIG.TEXT_LIMITS?.maxCharsForText}`);
   console.log(`===============================\n`);
 }
};

// ===== LAYER COMPATIBILITÀ =====

export const LegacyCompatibility = {
 analyzeContentStructure: async (examName, filesArray, originalFilesDriveInfo, userDescription = "", progressCallback) => {
   console.warn(`\n⚠️ LEGACY: analyzeContentStructure -> analyzeContentStructureMultiPhase`);
   const result = await analyzeContentStructureMultiPhase(examName, filesArray, originalFilesDriveInfo, userDescription, progressCallback, 'pdf');
   return {
     tableOfContents: result.tableOfContents,
     pageMapping: result.pageMapping
   };
 },
 
 distributeTopicsOptimized: async (examName, totalDays, topics, userDescription = "", progressCallback) => {
   console.warn(`\n⚠️ LEGACY: distributeTopicsOptimized -> distributeTopicsMultiPhase`);
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
 generateCompleteStudyPlan, // Originale (DEPRECATA)
 generateCompleteStudyPlanLocal, // NUOVA FUNZIONE OTTIMIZZATA ⭐
 analyzeContentMultiPhase,
 distributeTopicsMultiPhase,
 
 // Legacy (compatibilità)
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

// ===== INFO ARCHITETTURA AGGIORNATA =====

console.log(`\n🎯 ===== GEMINI ORCHESTRATOR v2.0 CARICATO =====`);
console.log(`🚀 FUNZIONE PRINCIPALE: generateCompleteStudyPlanLocal()`);
console.log(`📊 ARCHITETTURA: 5 fasi analisi + 1 fase distribuzione`);
console.log(`🔧 MODALITÀ: PDF (completa) | TEXT (veloce)`);
console.log(`💾 CACHE: Ottimizzata per performance`);
console.log(`🔍 LOGGING: Dettagliato per debugging`);
console.log(`⚡ INDIPENDENZA: Moduli completamente autonomi`);
console.log(`===============================================\n`);