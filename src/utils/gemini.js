// src/utils/gemini.js - ENTRY POINT SEMPLIFICATO v2.0

// ===== IMPORT DAL NUOVO ORCHESTRATORE MODULARE =====
import GeminiMainOrchestrator, {
  generateCompleteStudyPlanLocal, // ⭐ FUNZIONE PRINCIPALE
  analyzeContentStructureMultiPhase,
  distributeTopicsMultiPhase,
  createStudyPlanInput,
  getSystemInfo,
  cleanupSystem,
  GeminiUtils
} from './gemini/geminiMainOrchestrator.js';

// ===== CONFIGURAZIONE GENERALE =====
import { SHARED_CONFIG } from './gemini/shared/geminiShared.js';

// ===== EXPORT PRINCIPALI (Nuova architettura) =====

// FUNZIONE PRINCIPALE OTTIMIZZATA ⭐
export { generateCompleteStudyPlanLocal };

// Accesso diretto ai moduli
export { analyzeContentStructureMultiPhase, distributeTopicsMultiPhase };

// ===== NUOVE FUNZIONI MULTI-FASE (Accesso diretto) =====

// Versioni più avanzate delle funzioni
export const analyzeContentMultiPhase = async (examName, filesArray, originalFilesDriveInfo, userDescription = "", progressCallback = null, analysisMode = 'pdf') => {
  console.log(`🔧 Direct module access: analyzeContentMultiPhase (${analysisMode})`);
  return await analyzeContentStructureMultiPhase(examName, filesArray, originalFilesDriveInfo, userDescription, progressCallback, analysisMode);
};

export const distributeTopicsMultiPhaseAdvanced = async (examName, totalDays, topics, userDescription = "", progressCallback = null) => {
  console.log(`🔧 Direct module access: distributeTopicsMultiPhaseAdvanced`);
  return await distributeTopicsMultiPhase(examName, totalDays, topics, userDescription, progressCallback);
};

// ===== UTILITÀ E CONFIGURAZIONE =====

// Configurazione (accesso read-only)
export const CONFIG = { ...SHARED_CONFIG };
export const GeminiMultiPhaseConfig = CONFIG;

// Utilità complete
export { GeminiUtils };

// Utility semplici per backward compatibility
export const getCacheStats = GeminiUtils.getCacheStats;
export const clearAllCaches = GeminiUtils.clearAllCaches;

// ===== FUNZIONI DI SUPPORTO =====

// Helper per creare input standardizzato
export { createStudyPlanInput };

// Informazioni sistema
export { getSystemInfo, cleanupSystem };

// ===== CONFIGURAZIONE E GESTIONE =====

/**
 * Aggiorna la configurazione del sistema
 */
export function updateGeminiConfig(newConfig) {
  Object.assign(SHARED_CONFIG, newConfig);
  console.log('⚙️ Configurazione Gemini aggiornata:', newConfig);
  return SHARED_CONFIG;
}

/**
 * Ottiene la configurazione corrente
 */
export function getGeminiConfig() {
  return { ...SHARED_CONFIG };
}

/**
 * Reset completo del sistema (cache + config)
 */
export function resetGeminiSystem() {
  const stats = cleanupSystem();
  console.log('🔄 Sistema Gemini completamente resettato');
  return stats;
}

// ===== DIAGNOSTICA E DEBUG =====

/**
 * Esegue diagnostica completa del sistema
 */
export function runGeminiDiagnostics() {
  console.log('\n🔍 ===== DIAGNOSTICA GEMINI AI =====');
  
  const systemInfo = GeminiUtils.logSystemInfo();
  
  console.log('\n📋 FUNZIONI DISPONIBILI:');
  console.log('  🚀 generateCompleteStudyPlanLocal() - PRINCIPALE (v2.0)');
  console.log('  🔧 analyzeContentMultiPhase() - Analisi diretta');
  console.log('  🔧 distributeTopicsMultiPhase() - Distribuzione diretta');
  console.log('  ⚙️ GeminiUtils.* - Utilità complete');
  
  console.log('\n✅ FUNZIONALITÀ:');
  console.log('  🏗️ Architettura modulare indipendente');
  console.log('  🔧 Supporto modalità PDF e TEXT');
  console.log('  💾 Cache intelligente multi-livello');
  
  console.log('\n🎯 RACCOMANDAZIONI:');
  console.log('  • Usa generateCompleteStudyPlanLocal() per nuovi progetti');
  console.log('  • Modalità "text" per velocità, "pdf" per precisione');
  console.log('  • Cache automatica per performance ottimali');
  
  console.log('===== FINE DIAGNOSTICA =====\n');
  
  return systemInfo;
}

/**
 * Test rapido del sistema
 */
export async function testGeminiSystem(testFiles = null) {
  console.log('🧪 Test sistema Gemini...');
  
  try {
    // Test configurazione
    const config = getGeminiConfig();
    console.log('✅ Configurazione OK');
    
    // Test cache
    const cacheStats = getCacheStats();
    console.log('✅ Sistema cache OK:', cacheStats);
    
    // Test moduli (solo se forniti file di test)
    if (testFiles && testFiles.length > 0) {
      console.log('🏃 Esecuzione benchmark...');
      const benchmark = await GeminiUtils.benchmarkAnalysis('Test Exam', testFiles, 'text');
      console.log('✅ Benchmark completato:', benchmark);
    }
    
    console.log('🎉 Sistema Gemini completamente funzionante!');
    return { success: true, config, cacheStats };
    
  } catch (error) {
    console.error('❌ Test fallito:', error.message);
    return { success: false, error: error.message };
  }
}

// ===== EXPORT DEFAULT =====

export default {
  // ⭐ FUNZIONE PRINCIPALE RACCOMANDATA
  generateCompleteStudyPlanLocal,
  
  // Nuove funzioni avanzate
  analyzeContentMultiPhase,
  distributeTopicsMultiPhase,
  analyzeContentStructureMultiPhase,
  distributeTopicsMultiPhaseAdvanced,
  
  // Utilità e configurazione
  CONFIG,
  GeminiUtils,
  GeminiMultiPhaseConfig,
  
  // Gestione sistema
  createStudyPlanInput,
  getSystemInfo,
  cleanupSystem,
  updateGeminiConfig,
  getGeminiConfig,
  resetGeminiSystem,
  
  // Diagnostica
  runGeminiDiagnostics,
  testGeminiSystem,
  
  // Accesso ai moduli (per uso avanzato)
  modules: {
    orchestrator: GeminiMainOrchestrator
  }
};

// ===== INIZIALIZZAZIONE SISTEMA =====

console.log(`🎯 GEMINI AI SYSTEM v2.0 CARICATO (SEMPLIFICATO)`);
console.log(`🚀 FUNZIONE PRINCIPALE: generateCompleteStudyPlanLocal()`);
console.log(`📊 ARCHITETTURA: Modulare indipendente (4 moduli)`);
console.log(`🔧 MODALITÀ: PDF (precisa), TEXT (veloce)`);
console.log(`💡 Esegui runGeminiDiagnostics() per informazioni complete`);

// ===== INFORMAZIONI ARCHITETTURA =====

/**
 * ARCHITETTURA GEMINI AI v2.0 - MODULARE SEMPLIFICATA
 * 
 * STRUTTURA:
 * 
 * 📁 gemini/
 * ├── 📄 gemini.js (questo file - entry point)
 * ├── 📁 shared/
 * │   └── 📄 geminiShared.js (utilità condivise)
 * ├── 📁 services/
 * │   └── 📄 geminiAIService.js (servizio AI Gemini)
 * ├── 📁 modules/
 * │   ├── 📄 contentAnalysisModule.js (analisi contenuti)
 * │   └── 📄 distributionModule.js (distribuzione argomenti)
 * └── 📄 geminiMainOrchestrator.js (orchestratore principale)
 * 
 * PRINCIPI:
 * - ✅ Ogni modulo è completamente indipendente
 * - ✅ Input/Output chiaramente definiti
 * - ✅ Nessuna dipendenza circolare
 * - ✅ Funzioni condivise centralizzate
 * - ✅ Cache multi-livello intelligente
 * - ✅ Gestione errori robusta
 * 
 * WORKFLOW:
 * 1. CreateProject → generateCompleteStudyPlanLocal()
 * 2. Orchestrator → contentAnalysisModule → 4 fasi
 * 3. Orchestrator → distributionModule → 2 fasi
 * 4. Return → formato compatibile per PlanReviewModal
 * 
 * VANTAGGI:
 * 🚀 Performance: Cache intelligente + modalità text veloce
 * 🔧 Manutenibilità: Moduli indipendenti facili da modificare
 * 🛡️ Robustezza: Validazione e gestione errori completa
 * 🔄 Flessibilità: Possibilità di usare singoli moduli
 */