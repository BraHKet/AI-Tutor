// src/utils/gemini/geminiOrchestrator.js - VERSIONE COMPLETAMENTE INDIPENDENTE
import { analyzeContentStructureMultiPhase } from './contentAnalysisPhases.js';
import { distributeTopicsMultiPhase } from './distributionPhases.js';
import { CONFIG, clearAllCaches, getCacheStats } from './geminiCore.js';

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
  
  console.log(`🎯 INIZIO ORCHESTRAZIONE GEMINI AI`);
  console.log(`📚 Esame: "${examName}" | 🗓️ Giorni: ${totalDays} | 🔧 Modalità: ${analysisMode.toUpperCase()}`);
  console.log(`📁 File: ${files?.length || 0} | 📝 Note: ${userDescription || 'Nessuna'}`);
  
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
      console.warn(`Modalità "${analysisMode}" non valida, uso 'pdf'`);
      analysisMode = 'pdf';
    }
    
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

    // ANALISI CONTENUTI (5 fasi) - Locale con modalità selezionata
    progressCallback?.({ type: 'processing', message: `AI - Analisi contenuti (${analysisMode === 'pdf' ? 'PDF completo' : 'solo testo'})...` });
    
    console.log(`🚀 Avvio analisi contenuti (${analysisMode})...`);
    
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
    
    console.log(`✅ Analisi contenuti: ${contentIndex.length} argomenti generati`);
    progressCallback?.({ type: 'processing', message: `Analisi contenuti completata (${analysisMode}).` });

    // DISTRIBUZIONE (1 fase semplificata)
    progressCallback?.({ type: 'processing', message: 'AI - Distribuzione argomenti...' });
    
    console.log(`🚀 Avvio distribuzione...`);
    
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

    console.log(`✅ Distribuzione: ${topicDistribution.dailyPlan.length} giorni pianificati`);
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
    console.log(`🎉 ORCHESTRAZIONE COMPLETATA in ${duration}ms`);
    console.log(`✅ Risultato: ${contentIndex.length} argomenti, ${topicDistribution.dailyPlan.length} giorni`);
    
    progressCallback?.({ type: 'processing', message: `Analisi locale completata (${analysisMode})!` });
    
    return completePlan;

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ ORCHESTRAZIONE FALLITA dopo ${duration}ms:`, error);
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
  
  console.log(`⚠️ USANDO FUNZIONE LEGACY generateCompleteStudyPlan`);
  console.log(`💡 Consiglio: usa generateCompleteStudyPlanLocal`);
  
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
   console.log(`🎉 LEGACY COMPLETATA in ${duration}ms`);
   
   return completePlan;

 } catch (error) {
   const duration = Date.now() - startTime;
   console.error(`❌ LEGACY FALLITA dopo ${duration}ms:`, error);
   throw new Error(`Errore AI: ${error.message}`);
 }
};

// ===== FUNZIONI LEGACY (compatibilità) =====

export const generateContentIndex = async (examName, filesArray, originalFilesDriveInfo, userDescription = "") => {
 console.warn(`⚠️ LEGACY: generateContentIndex -> analyzeContentStructureMultiPhase`);
 const result = await analyzeContentStructureMultiPhase(examName, filesArray, originalFilesDriveInfo, userDescription, null, 'pdf');
 return {
   tableOfContents: result.tableOfContents,
   pageMapping: result.pageMapping
 };
};

export const distributeTopicsToDays = async (examName, totalDays, topics, userDescription = "") => {
 console.warn(`⚠️ LEGACY: distributeTopicsToDays -> distributeTopicsMultiPhase`);
 const result = await distributeTopicsMultiPhase(examName, totalDays, topics, userDescription);
 return {
   dailyPlan: result.dailyPlan
 };
};

// ===== ACCESSO DIRETTO ALLE FASI =====

export const analyzeContentMultiPhase = async (examName, filesArray, originalFilesDriveInfo, userDescription = "", progressCallback = null, analysisMode = 'pdf') => {
 console.log(`🔧 Direct phase access: analyzeContentMultiPhase (${analysisMode})`);
 return await analyzeContentStructureMultiPhase(examName, filesArray, originalFilesDriveInfo, userDescription, progressCallback, analysisMode);
};

export const distributeTopicsMultiPhaseAdvanced = async (examName, totalDays, topics, userDescription = "", progressCallback = null) => {
 console.log(`🔧 Direct phase access: distributeTopicsMultiPhaseAdvanced`);
 return await distributeTopicsMultiPhase(examName, totalDays, topics, userDescription, progressCallback);
};

// ===== UTILITÀ SEMPLIFICATE =====

export const GeminiUtils = {
 // Cache management
 clearAllCaches: () => {
   const clearedCount = clearAllCaches();
   console.log(`🗑️ Cache pulite: ${clearedCount} elementi`);
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
   console.log('⚙️ Configurazione aggiornata:', newConfig);
 },
 
 // Diagnostica
 logSystemInfo: () => {
   console.log(`📊 GEMINI SYSTEM INFO`);
   console.log(`⚙️ Config:`, CONFIG);
   console.log(`💾 Cache:`, GeminiUtils.getCacheStats());
   console.log(`🔧 Modalità: PDF (completa), TEXT (veloce)`);
 }
};

// ===== LAYER COMPATIBILITÀ =====

export const LegacyCompatibility = {
 analyzeContentStructure: async (examName, filesArray, originalFilesDriveInfo, userDescription = "", progressCallback) => {
   console.warn(`⚠️ LEGACY: analyzeContentStructure -> analyzeContentStructureMultiPhase`);
   const result = await analyzeContentStructureMultiPhase(examName, filesArray, originalFilesDriveInfo, userDescription, progressCallback, 'pdf');
   return {
     tableOfContents: result.tableOfContents,
     pageMapping: result.pageMapping
   };
 },
 
 distributeTopicsOptimized: async (examName, totalDays, topics, userDescription = "", progressCallback) => {
   console.warn(`⚠️ LEGACY: distributeTopicsOptimized -> distributeTopicsMultiPhase`);
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

console.log(`🎯 GEMINI ORCHESTRATOR v2.0 CARICATO`);
console.log(`🚀 FUNZIONE PRINCIPALE: generateCompleteStudyPlanLocal()`);
console.log(`📊 ARCHITETTURA: 5 fasi analisi + 1 fase distribuzione`);