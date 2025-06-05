// src/utils/gemini/modules/contentAnalysis/contentAnalysisOrchestrator.js

import { 
  createContentPhaseOutput, 
  validatePhaseInput,
  logPhase,
  createPhaseError,
  executePhaseWithErrorHandling
} from '../../shared/geminiShared.js';

// IMPORT CORRETTI con i nomi delle funzioni aggiornate
import { performInitialIndexSearch } from './phase1_indexSearch.js';
import { performComprehensivePageByPageAnalysis } from './phase2_pageByPageAnalysis.js';
import { performIntelligentTopicSynthesis } from './phase3_topicSynthesis.js';
import { performFinalValidationAndOptimization } from './phase4_validation.js';

export const MODULE_CONFIG = {
  SINGLE_CALL_MODE: true,
  MEGA_PROMPT_ANALYSIS: true,
  MIN_TOPIC_QUALITY_SCORE: 0.1,
  MAX_TOPICS_UNLIMITED: true,
  MAX_PHASE1_RETRIES: 3 // Numero massimo di retry tra Fase 1 e 2
};

/**
 * Esegue l'analisi completa dei contenuti orchestrando le varie fasi.
 * INPUT: ContentAnalysisInput
 * OUTPUT: ContentAnalysisOutput
 */
export async function analyzeContent(input) {
  const { examName, files, userDescription = '', analysisMode = 'pdf', progressCallback } = input;
  
  validatePhaseInput('content-analysis-orchestrator', examName, files);
  
  logPhase('content-analysis-orchestrator', `AVVIO ANALISI CONTENUTI (${analysisMode.toUpperCase()})`);
  logPhase('content-analysis-orchestrator', `📚 ${examName} | 📁 ${files?.length || 0} file | 📝 ${userDescription || 'Nessuna nota'}`);
  
  const phaseResults = {};

  try {
    // CICLO RETRY: FASE 1 + FASE 2 finché la validazione non passa
    let indexSearchResult;
    let sectionValidationResult;
    let retryCount = 0;
    const maxRetries = MODULE_CONFIG.MAX_PHASE1_RETRIES;
    
    while (retryCount < maxRetries) {
      // FASE 1: Ricerca Indice e Struttura Globale
      progressCallback?.({ type: 'processing', message: `Fase 1: Ricerca indice e struttura (${analysisMode}) - Tentativo ${retryCount + 1}...` });
      logPhase('content-analysis-orchestrator', `🔄 FASE 1 - Tentativo ${retryCount + 1}/${maxRetries}`);
      
      indexSearchResult = await executePhaseWithErrorHandling(
        'phase1-index-search',
        performInitialIndexSearch,
        { examName, files, userDescription, analysisMode, progressCallback }
      );
      
      // FASE 2: Validazione Sezioni
      progressCallback?.({ type: 'processing', message: `Fase 2: Validazione sezioni identificate (${analysisMode}) - Tentativo ${retryCount + 1}...` });
      logPhase('content-analysis-orchestrator', `🔍 FASE 2 - Validazione tentativo ${retryCount + 1}/${maxRetries}`);
      
      sectionValidationResult = await executePhaseWithErrorHandling(
        'phase2-section-validation',
        performComprehensivePageByPageAnalysis,
        { examName, files, phase1Output: indexSearchResult, userDescription, analysisMode, progressCallback }
      );
      
      // CONTROLLO VALIDAZIONE
      const validationSuccess = sectionValidationResult?.validationSummary?.validationSuccess;
      const validSections = sectionValidationResult?.validationSummary?.validSections || 0;
      const totalSections = sectionValidationResult?.validationSummary?.totalSections || 0;
      
      logPhase('content-analysis-orchestrator', `📊 VALIDAZIONE: ${validSections}/${totalSections} sezioni valide, Success: ${validationSuccess}`);
      
      if (validationSuccess === true) {
        logPhase('content-analysis-orchestrator', `✅ VALIDAZIONE PASSATA al tentativo ${retryCount + 1}`);
        break; // Validazione passata, esci dal loop
      } else {
        retryCount++;
        logPhase('content-analysis-orchestrator', `❌ VALIDAZIONE FALLITA - Tentativo ${retryCount}/${maxRetries}`);
        
        if (retryCount >= maxRetries) {
          logPhase('content-analysis-orchestrator', `🚨 RAGGIUNTO LIMITE RETRY - Procedo con risultati parziali`);
          // Usa l'ultimo risultato anche se non perfetto
          break;
        } else {
          logPhase('content-analysis-orchestrator', `🔄 RETRY FASE 1+2 tra 2 secondi...`);
          // Piccola pausa prima del retry
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    // Salva i risultati delle fasi 1 e 2
    phaseResults.indexSearch = indexSearchResult;
    phaseResults.sectionValidation = sectionValidationResult;
    phaseResults.retryInfo = {
      totalRetries: retryCount,
      validationPassed: sectionValidationResult?.validationSummary?.validationSuccess === true,
      finalAttempt: retryCount + 1
    };

    // FASE 3: Analisi Dettagliata Sezioni
    progressCallback?.({ type: 'processing', message: 'Fase 3: Analisi dettagliata sezioni...' });
    const synthesisResult = await executePhaseWithErrorHandling(
      'phase3-section-analysis',
      performIntelligentTopicSynthesis,
      { 
        examName, 
        pageAnalysisResult: sectionValidationResult, 
        phase1Output: indexSearchResult, // Passa anche la Fase 1
        userDescription, 
        progressCallback 
      }
    );
    phaseResults.synthesis = synthesisResult;
    
    // FASE 4: Validazione e Ottimizzazione Finale
    progressCallback?.({ type: 'processing', message: 'Fase 4: Validazione e ottimizzazione finale...' });
    const finalResult = await executePhaseWithErrorHandling(
      'phase4-final-validation',
      performFinalValidationAndOptimization,
      { 
        synthesisResult, 
        files, 
        initialComprehensiveAnalysisResult: sectionValidationResult, 
        examName, 
        progressCallback 
      }
    );
    phaseResults.validationAndOptimization = finalResult;
    
    const output = createContentPhaseOutput('content-analysis-orchestrator', {
      topics: finalResult.validatedTopics,
      statistics: finalResult.statistics,
      phaseResults: phaseResults
    }, {
      analysisMode,
      totalFiles: files.length,
      totalTopics: finalResult.validatedTopics?.length || 0,
      totalPages: finalResult.statistics?.totalPages || 0,
      qualityScore: finalResult.validationReport?.qualityScore || 0,
      architecture: "multi-phase-with-retry",
      indexFound: indexSearchResult.indexAnalysis?.indexFound || false,
      sectionsValidated: sectionValidationResult.validationSummary?.validSections || 0,
      retryCount: retryCount,
      validationPassed: sectionValidationResult?.validationSummary?.validationSuccess === true
    });

    logPhase('content-analysis-orchestrator', `ANALISI COMPLETATA: ${output.data.topics.length} argomenti, ${output.data.statistics.totalPages} pagine`);
    logPhase('content-analysis-orchestrator', `RETRY INFO: ${retryCount} tentativi, Validazione: ${output.metadata.validationPassed ? 'PASSATA' : 'PARZIALE'}`);
    logPhase('content-analysis-orchestrator', `QUALITÀ FINALE: ${Math.round((finalResult.validationReport?.qualityScore || 0) * 100)}%`);
    progressCallback?.({ type: 'success', message: `Analisi contenuti completata (${analysisMode})!` });
    
    return output;

  } catch (error) {
    logPhase('content-analysis-orchestrator', `ERRORE CRITICO NELL'ORCHESTRAZIONE: ${error.message}`);
    progressCallback?.({ type: 'error', message: `Errore analisi: ${error.message}` });
    
    // Gestione fallback specifici per fase
    if (error.phase === 'phase1-index-search') {
        logPhase('content-analysis-orchestrator', 'Errore in Fase 1 (ricerca indice) - tentativo fallback...');
        try {
            const fallbackIndexData = generateMinimalIndexStructure(files, examName, analysisMode);
            // Continua con la Fase 2 usando i dati di fallback
            const sectionValidationResult = await performComprehensivePageByPageAnalysis({
                examName, files, phase1Output: fallbackIndexData, userDescription, analysisMode, progressCallback
            });
            // Continua con le fasi successive...
            return createContentPhaseOutput('content-analysis-orchestrator', {
                topics: [], // Risultato parziale
                statistics: { totalPages: 0 },
                phaseResults: { indexSearchFallback: fallbackIndexData, sectionValidation: sectionValidationResult },
                fallbackApplied: true,
            }, { analysisMode, totalFiles: files.length, notes: "Fallback applicato dopo errore Fase 1" });
        } catch (fallbackError) {
             logPhase('content-analysis-orchestrator', `Errore durante il fallback Fase 1: ${fallbackError.message}`);
        }
    } else if (error.phase === 'phase2-section-validation' && phaseResults.indexSearch) {
        logPhase('content-analysis-orchestrator', 'Errore in Fase 2 (validazione sezioni) - tentativo fallback...');
        try {
            const fallbackValidationData = generateMinimalValidationData(phaseResults.indexSearch);
            return createContentPhaseOutput('content-analysis-orchestrator', {
                topics: [],
                statistics: { totalPages: 0 },
                phaseResults: { indexSearch: phaseResults.indexSearch, sectionValidationFallback: fallbackValidationData },
                fallbackApplied: true,
            }, { analysisMode, totalFiles: files.length, notes: "Fallback applicato dopo errore Fase 2" });
        } catch (fallbackError) {
             logPhase('content-analysis-orchestrator', `Errore durante il fallback Fase 2: ${fallbackError.message}`);
        }
    } else if (!files || files.length === 0) {
        logPhase('content-analysis-orchestrator', 'Nessun file fornito, generazione output minimale.');
        const minimalData = generateCompleteMinimalAnalysis(files || [], examName, analysisMode);
         return createContentPhaseOutput('content-analysis-orchestrator', {
            topics: [],
            statistics: { totalPages: 0 },
            phaseResults: { minimalAnalysis: minimalData },
            minimalAnalysis: true,
        }, { analysisMode, totalFiles: 0, notes: "Analisi minimale causa assenza di file." });
    }

    throw createPhaseError('content-analysis-orchestrator', `Errore durante l'orchestrazione dell'analisi: ${error.message}`, error);
  }
}

// ===== FUNZIONI DI FALLBACK SPECIFICHE =====

function generateMinimalIndexStructure(files, examName, analysisMode) {
  logPhase('fallback-index', 'Generazione struttura indice minimale...');
  const fileCount = files?.length || 0;
  const estimatedPagesPerFile = fileCount > 0 ? 30 : 0;

  return {
    globalStructure: {
      totalFiles: fileCount,
      materialType: 'mixed',
      overallOrganization: `Materiale per ${examName} - Struttura Minimale`,
      estimatedTotalPages: fileCount * estimatedPagesPerFile,
      hasMainIndex: false,
      indexLocation: { fileIndex: 0, startPage: 1, endPage: 1, indexType: 'none' },
      mainSections: files?.map((f, i) => ({ 
        sectionTitle: f.name, 
        fileIndex: i, 
        startPage: 1, 
        endPage: estimatedPagesPerFile, 
        sectionType: 'chapter', 
        importance: 'medium', 
        description: `File ${f.name} - sezione generica` 
      })) || []
    },
    indexAnalysis: {
      indexFound: false,
      indexQuality: 'none',
      totalEntries: 0,
      indexUtility: 'low'
    },
    analysisMetadata: {
      analysisMode: analysisMode,
      searchStrategy: 'fallback minimale',
      confidenceLevel: 0.1,
      recommendedNextSteps: ['Analisi dettagliata con dati minimali']
    }
  };
}

function generateMinimalValidationData(indexSearchResult) {
  logPhase('fallback-validation', 'Generazione validazione minimale...');
  const sections = indexSearchResult.globalStructure?.mainSections || [];
  
  return {
    sectionValidation: sections.map((section, index) => ({
      sectionIndex: index,
      sectionTitle: section.sectionTitle,
      fileIndex: section.fileIndex,
      startPage: section.startPage,
      endPage: section.endPage,
      isValid: true,
      validationNotes: "Validazione automatica fallback"
    })),
    validationSummary: {
      totalSections: sections.length,
      validSections: sections.length,
      validationSuccess: true
    },
    analysisMetadata: {
      analysisMode: 'fallback',
      processingNotes: 'Validazione generata tramite fallback'
    }
  };
}

function generateCompleteMinimalAnalysis(files, examName, analysisMode) {
  logPhase('minimal-analysis', 'Generazione analisi completa minimale...');
  const indexData = generateMinimalIndexStructure(files, examName, analysisMode);
  const validationData = generateMinimalValidationData(indexData);
  
  return {
    indexSearch: indexData,
    sectionValidation: validationData,
    synthesis: { synthesizedTopics: [], synthesisStatistics: { originalSections: 0, analyzedSections: 0 } },
    validation: { validatedTopics: [], statistics: { totalTopics: 0, totalPages: 0 } }
  };
}

export default {
  analyzeContent,
  MODULE_CONFIG
};