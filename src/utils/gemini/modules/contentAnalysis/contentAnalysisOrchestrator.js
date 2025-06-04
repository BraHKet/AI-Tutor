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
  MAX_TOPICS_UNLIMITED: true 
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
    // FASE 1: Ricerca Indice e Struttura Globale (LEGGERA)
    progressCallback?.({ type: 'processing', message: `Fase 1: Ricerca indice e struttura (${analysisMode})...` });
    const indexSearchResult = await executePhaseWithErrorHandling(
      'phase1-index-search',
      performInitialIndexSearch,
      { examName, files, userDescription, analysisMode, progressCallback }
    );
    phaseResults.indexSearch = indexSearchResult;
    
    // FASE 2: Analisi Completa Pagina per Pagina (PESANTE)
    progressCallback?.({ type: 'processing', message: `Fase 2: Analisi dettagliata pagina per pagina (${analysisMode})...` });
    const comprehensiveAnalysisResult = await executePhaseWithErrorHandling(
      'phase2-comprehensive-analysis',
      performComprehensivePageByPageAnalysis,
      { examName, files, phase1Output: indexSearchResult, userDescription, analysisMode, progressCallback }
    );
    phaseResults.comprehensiveAnalysis = comprehensiveAnalysisResult;

    // FASE 3: Sintesi Intelligente Argomenti
    progressCallback?.({ type: 'processing', message: 'Fase 3: Sintesi intelligente argomenti...' });
    const synthesisResult = await executePhaseWithErrorHandling(
      'phase3-topic-synthesis',
      performIntelligentTopicSynthesis,
      { examName, pageAnalysisResult: comprehensiveAnalysisResult, userDescription, progressCallback }
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
        initialComprehensiveAnalysisResult: comprehensiveAnalysisResult, 
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
      architecture: "multi-phase",
      indexFound: indexSearchResult.indexAnalysis?.indexFound || false,
      pagesAnalyzedInDetailedScan: comprehensiveAnalysisResult.pageByPageAnalysis?.length || 0
    });

    logPhase('content-analysis-orchestrator', `ANALISI COMPLETATA: ${output.data.topics.length} argomenti, ${output.data.statistics.totalPages} pagine`);
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
            const comprehensiveAnalysisResult = await performComprehensivePageByPageAnalysis({
                examName, files, phase1Output: fallbackIndexData, userDescription, analysisMode, progressCallback
            });
            // Continua con le fasi successive...
            return createContentPhaseOutput('content-analysis-orchestrator', {
                topics: [], // Risultato parziale
                statistics: { totalPages: 0 },
                phaseResults: { indexSearchFallback: fallbackIndexData, comprehensiveAnalysis: comprehensiveAnalysisResult },
                fallbackApplied: true,
            }, { analysisMode, totalFiles: files.length, notes: "Fallback applicato dopo errore Fase 1" });
        } catch (fallbackError) {
             logPhase('content-analysis-orchestrator', `Errore durante il fallback Fase 1: ${fallbackError.message}`);
        }
    } else if (error.phase === 'phase2-comprehensive-analysis' && phaseResults.indexSearch) {
        logPhase('content-analysis-orchestrator', 'Errore in Fase 2 (analisi completa) - tentativo fallback...');
        try {
            const fallbackPageData = generateMinimalPageAnalysis(phaseResults.indexSearch, files);
            return createContentPhaseOutput('content-analysis-orchestrator', {
                topics: [],
                statistics: { totalPages: fallbackPageData.pageByPageAnalysis?.length || 0 },
                phaseResults: { indexSearch: phaseResults.indexSearch, comprehensiveAnalysisFallback: fallbackPageData },
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

function generateMinimalPageAnalysis(indexSearchResult, files) {
  logPhase('fallback-pages', 'Generazione analisi pagine minimale...');
  const sections = indexSearchResult.globalStructure?.mainSections || [];
  const mockPages = [];
  
  sections.forEach(section => {
    for (let pageNum = section.startPage; pageNum <= Math.min(section.endPage, section.startPage + 10); pageNum++) {
      mockPages.push({
        fileIndex: section.fileIndex,
        fileName: files[section.fileIndex]?.name || 'unknown.pdf',
        pageNumber: pageNum,
        pageTitle: `Pagina ${pageNum} - ${section.sectionTitle}`,
        sectionContext: section.sectionTitle,
        contentType: 'mixed',
        mainTopics: [{
          topicName: `Argomento p.${pageNum}`,
          description: 'Contenuto generico',
          importance: 'medium',
          keyPoints: ['Concetto base'],
          conceptType: 'definition'
        }],
        difficulty: 'intermediate',
        estimatedStudyTime: 15,
        contentElements: { hasFormulas: false, hasExercises: false, hasImages: false, hasTables: false, textDensity: 'medium' },
        keyTerms: [],
        prerequisites: [],
        learningObjectives: [`Apprendere contenuto pagina ${pageNum}`],
        studyNotes: 'Studio standard',
        qualityIndicators: { contentClarity: 'fair', conceptDensity: 'medium', examRelevance: 'useful' }
      });
    }
  });

  return {
    pageByPageAnalysis: mockPages,
    contentSummary: {
      totalPagesAnalyzed: mockPages.length,
      contentDistribution: { theory: mockPages.length, examples: 0, exercises: 0, mixed: 0 },
      difficultyBreakdown: { beginner: 0, intermediate: mockPages.length, advanced: 0 },
      specialElements: { formulaPages: 0, exercisePages: 0, imagePages: 0, tablePages: 0 },
      estimatedTotalStudyTime: mockPages.length * 15
    },
    analysisMetadata: {
      analysisMode: 'fallback',
      completeness: 0.3,
      confidence: 0.3,
      processingNotes: 'Analisi pagine generata tramite fallback'
    }
  };
}

function generateCompleteMinimalAnalysis(files, examName, analysisMode) {
  logPhase('minimal-analysis', 'Generazione analisi completa minimale...');
  const indexData = generateMinimalIndexStructure(files, examName, analysisMode);
  const pageData = generateMinimalPageAnalysis(indexData, files);
  
  return {
    indexSearch: indexData,
    comprehensiveAnalysis: pageData,
    synthesis: { synthesizedTopics: [], synthesisStatistics: { originalPages: 0, synthesizedTopics: 0 } },
    validation: { validatedTopics: [], statistics: { totalTopics: 0, totalPages: 0 } }
  };
}

export default {
  analyzeContent,
  MODULE_CONFIG
};