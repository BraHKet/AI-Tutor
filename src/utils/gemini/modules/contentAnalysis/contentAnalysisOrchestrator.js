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
  RANGE_CORRECTION_MODE: true,
  MIN_TOPIC_QUALITY_SCORE: 0.1,
  MAX_TOPICS_UNLIMITED: true,
  MAX_CORRECTION_RETRIES: 3 // Numero massimo di retry per correzione range
};

/**
 * Esegue l'analisi completa dei contenuti orchestrando le varie fasi.
 * INPUT: ContentAnalysisInput
 * OUTPUT: ContentAnalysisOutput
 */
export async function analyzeContent(input) {
  const { examName, files, userDescription = '', analysisMode = 'pdf', progressCallback } = input;
  
  validatePhaseInput('content-analysis-orchestrator', examName, files);
  
  logPhase('content-analysis-orchestrator', `AVVIO ANALISI CONTENUTI CON CORREZIONE RANGE (${analysisMode.toUpperCase()})`);
  logPhase('content-analysis-orchestrator', `📚 ${examName} | 📁 ${files?.length || 0} file | 📝 ${userDescription || 'Nessuna nota'}`);
  
  const phaseResults = {};

  try {
    // CICLO RETRY: FASE 1 + FASE 2 (correzione) finché i range non sono corretti
    let indexSearchResult;
    let rangeCorrectionResult;
    let retryCount = 0;
    const maxRetries = MODULE_CONFIG.MAX_CORRECTION_RETRIES;
    
    while (retryCount < maxRetries) {
      // FASE 1: Ricerca Indice e Struttura Globale
      progressCallback?.({ type: 'processing', message: `Fase 1: Ricerca indice e struttura (${analysisMode}) - Tentativo ${retryCount + 1}...` });
      logPhase('content-analysis-orchestrator', `🔄 FASE 1 - Tentativo ${retryCount + 1}/${maxRetries}`);
      
      indexSearchResult = await executePhaseWithErrorHandling(
        'phase1-index-search',
        performInitialIndexSearch,
        { examName, files, userDescription, analysisMode, progressCallback }
      );
      
      // FASE 2: Correzione Intelligente dei Range
      progressCallback?.({ type: 'processing', message: `Fase 2: Correzione range di pagine (${analysisMode}) - Tentativo ${retryCount + 1}...` });
      logPhase('content-analysis-orchestrator', `🔧 FASE 2 - Correzione range tentativo ${retryCount + 1}/${maxRetries}`);
      
      rangeCorrectionResult = await executePhaseWithErrorHandling(
        'phase2-range-correction',
        performComprehensivePageByPageAnalysis,
        { examName, files, phase1Output: indexSearchResult, userDescription, analysisMode, progressCallback }
      );
      
      // CONTROLLO QUALITÀ CORREZIONE
      const correctionSuccess = rangeCorrectionResult?.correctionSummary?.correctionSuccess;
      const correctedSections = rangeCorrectionResult?.correctionSummary?.correctedSections || 0;
      const totalSections = rangeCorrectionResult?.correctionSummary?.totalSections || 0;
      const majorCorrections = rangeCorrectionResult?.correctionSummary?.majorCorrections || 0;
      
      logPhase('content-analysis-orchestrator', `📊 CORREZIONE: ${correctedSections}/${totalSections} sezioni corrette, ${majorCorrections} correzioni importanti`);
      
      if (correctionSuccess === true && correctedSections > 0) {
        logPhase('content-analysis-orchestrator', `✅ CORREZIONE RANGE COMPLETATA al tentativo ${retryCount + 1}`);
        break; // Correzione riuscita, esci dal loop
      } else {
        retryCount++;
        logPhase('content-analysis-orchestrator', `❌ CORREZIONE RANGE INSUFFICIENTE - Tentativo ${retryCount}/${maxRetries}`);
        
        if (retryCount >= maxRetries) {
          logPhase('content-analysis-orchestrator', `🚨 RAGGIUNTO LIMITE RETRY CORREZIONE - Procedo con risultati parziali`);
          // Usa l'ultimo risultato anche se non perfetto
          break;
        } else {
          logPhase('content-analysis-orchestrator', `🔄 RETRY CORREZIONE RANGE tra 2 secondi...`);
          // Piccola pausa prima del retry
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    // Salva i risultati delle fasi 1 e 2
    phaseResults.indexSearch = indexSearchResult;
    phaseResults.rangeCorrection = rangeCorrectionResult;
    phaseResults.correctionInfo = {
      totalRetries: retryCount,
      correctionSuccessful: rangeCorrectionResult?.correctionSummary?.correctionSuccess === true,
      finalAttempt: retryCount + 1,
      majorCorrections: rangeCorrectionResult?.correctionSummary?.majorCorrections || 0
    };

    // FASE 3: Analisi Dettagliata con Range Corretti
    progressCallback?.({ type: 'processing', message: 'Fase 3: Analisi dettagliata con range corretti...' });
    logPhase('content-analysis-orchestrator', '🔍 FASE 3 - Analisi dettagliata con range corretti');
    
    const synthesisResult = await executePhaseWithErrorHandling(
      'phase3-detailed-analysis',
      performIntelligentTopicSynthesis,
      { 
        examName, 
        pageAnalysisResult: rangeCorrectionResult, // Usa i range corretti
        userDescription, 
        progressCallback 
      }
    );
    phaseResults.synthesis = synthesisResult;
    
    // FASE 4: Validazione e Ottimizzazione Finale
    progressCallback?.({ type: 'processing', message: 'Fase 4: Validazione finale degli argomenti...' });
    logPhase('content-analysis-orchestrator', '✅ FASE 4 - Validazione finale');
    
    const finalResult = await executePhaseWithErrorHandling(
      'phase4-final-validation',
      performFinalValidationAndOptimization,
      { 
        synthesisResult, 
        files, 
        initialComprehensiveAnalysisResult: rangeCorrectionResult, 
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
      architecture: "multi-phase-with-range-correction",
      indexFound: indexSearchResult.indexAnalysis?.indexFound || false,
      rangesCorrected: rangeCorrectionResult.correctionSummary?.correctedSections || 0,
      majorCorrections: rangeCorrectionResult.correctionSummary?.majorCorrections || 0,
      retryCount: retryCount,
      correctionSuccessful: rangeCorrectionResult?.correctionSummary?.correctionSuccess === true
    });

    logPhase('content-analysis-orchestrator', `ANALISI COMPLETATA CON CORREZIONE RANGE: ${output.data.topics.length} argomenti, ${output.data.statistics.totalPages} pagine`);
    logPhase('content-analysis-orchestrator', `CORREZIONI: ${output.metadata.rangesCorrected} sezioni, ${output.metadata.majorCorrections} correzioni importanti`);
    logPhase('content-analysis-orchestrator', `RETRY INFO: ${retryCount} tentativi, Correzione: ${output.metadata.correctionSuccessful ? 'RIUSCITA' : 'PARZIALE'}`);
    logPhase('content-analysis-orchestrator', `QUALITÀ FINALE: ${Math.round((finalResult.validationReport?.qualityScore || 0) * 100)}%`);
    progressCallback?.({ type: 'success', message: `Analisi contenuti completata con correzione range (${analysisMode})!` });
    
    return output;

  } catch (error) {
    logPhase('content-analysis-orchestrator', `ERRORE CRITICO NELL'ORCHESTRAZIONE CON CORREZIONE: ${error.message}`);
    progressCallback?.({ type: 'error', message: `Errore analisi: ${error.message}` });
    
    // Gestione fallback specifici per fase
    if (error.phase === 'phase1-index-search') {
        logPhase('content-analysis-orchestrator', 'Errore in Fase 1 (ricerca indice) - tentativo fallback...');
        try {
            const fallbackIndexData = generateMinimalIndexStructure(files, examName, analysisMode);
            const rangeCorrectionResult = await performComprehensivePageByPageAnalysis({
                examName, files, phase1Output: fallbackIndexData, userDescription, analysisMode, progressCallback
            });
            return createContentPhaseOutput('content-analysis-orchestrator', {
                topics: [],
                statistics: { totalPages: 0 },
                phaseResults: { indexSearchFallback: fallbackIndexData, rangeCorrection: rangeCorrectionResult },
                fallbackApplied: true,
            }, { analysisMode, totalFiles: files.length, notes: "Fallback applicato dopo errore Fase 1" });
        } catch (fallbackError) {
             logPhase('content-analysis-orchestrator', `Errore durante il fallback Fase 1: ${fallbackError.message}`);
        }
    } else if (error.phase === 'phase2-range-correction' && phaseResults.indexSearch) {
        logPhase('content-analysis-orchestrator', 'Errore in Fase 2 (correzione range) - tentativo fallback...');
        try {
            const fallbackCorrectionData = generateMinimalCorrectionData(phaseResults.indexSearch);
            return createContentPhaseOutput('content-analysis-orchestrator', {
                topics: [],
                statistics: { totalPages: 0 },
                phaseResults: { indexSearch: phaseResults.indexSearch, rangeCorrectionFallback: fallbackCorrectionData },
                fallbackApplied: true,
            }, { analysisMode, totalFiles: files.length, notes: "Fallback applicato dopo errore Fase 2" });
        } catch (fallbackError) {
             logPhase('content-analysis-orchestrator', `Errore durante il fallback Fase 2: ${fallbackError.message}`);
        }
    }

    throw createPhaseError('content-analysis-orchestrator', `Errore durante l'orchestrazione con correzione range: ${error.message}`, error);
  }
}

// ===== FUNZIONI DI FALLBACK AGGIORNATE =====

function generateMinimalIndexStructure(files, examName, analysisMode) {
  logPhase('fallback-index', 'Generazione struttura indice minimale...');
  const fileCount = files?.length || 0;
  const estimatedPagesPerFile = fileCount > 0 ? 25 : 0;

  return {
    globalStructure: {
      totalFiles: fileCount,
      materialType: 'mixed',
      overallOrganization: `Materiale per ${examName} - Struttura Minimale`,
      estimatedTotalPages: fileCount * estimatedPagesPerFile,
      hasMainIndex: false,
      indexLocation: { fileIndex: 0, startPage: 1, endPage: 1, indexType: 'none' },
      mainSections: files?.map((f, i) => ({ 
        sectionTitle: f.name.replace('.pdf', ''), 
        fileIndex: i, 
        startPage: 1, 
        endPage: estimatedPagesPerFile, 
        sectionType: 'chapter', 
        importance: 'medium', 
        description: `Contenuto di ${f.name}` 
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
      recommendedNextSteps: ['Correzione manuale dei range']
    }
  };
}

function generateMinimalCorrectionData(indexSearchResult) {
  logPhase('fallback-correction', 'Generazione correzione minimale...');
  const sections = indexSearchResult.globalStructure?.mainSections || [];
  
  return {
    correctedSections: sections.map((section, index) => ({
      sectionIndex: index,
      originalTitle: section.sectionTitle,
      correctedTitle: section.sectionTitle,
      fileIndex: section.fileIndex,
      originalRange: { start: section.startPage, end: section.endPage },
      correctedRange: { start: section.startPage, end: Math.min(section.endPage, section.startPage + 25) },
      correctionType: "fallback_applied",
      correctionReason: "Correzione automatica fallback - range limitati a 25 pagine",
      contentQuality: "unknown",
      studyRecommendation: "Verifica manualmente il contenuto"
    })),
    correctionSummary: {
      totalSections: sections.length,
      correctedSections: sections.length,
      majorCorrections: 0,
      minorCorrections: sections.length,
      correctionSuccess: true
    },
    analysisMetadata: {
      analysisMode: 'fallback',
      correctionStrategy: 'Correzione automatica minimale',
      qualityAssessment: 'Bassa - richiede verifica manuale',
      processingNotes: 'Generato tramite fallback per evitare errori'
    }
  };
}

export default {
  analyzeContent,
  MODULE_CONFIG
};