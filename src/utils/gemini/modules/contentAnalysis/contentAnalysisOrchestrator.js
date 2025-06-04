// src/utils/gemini/modules/contentAnalysis/contentAnalysisOrchestrator.js

import { 
  createContentPhaseOutput, 
  validatePhaseInput,
  logPhase,
  createPhaseError,
  executePhaseWithErrorHandling
} from '../../shared/geminiShared.js';

// Importa le funzioni delle singole fasi
import { performInitialComprehensiveAnalysis } from './phase1_indexSearch.js';
import { processPageByPageData } from './phase2_pageByPageAnalysis.js';
import { performIntelligentTopicSynthesis } from './phase3_topicSynthesis.js';
import { performFinalValidationAndOptimization } from './phase4_validation.js';

// ===== CONFIGURAZIONE MODULO =====
export const MODULE_CONFIG = {
  SINGLE_CALL_MODE: true, // Questo è inerente a come performInitialComprehensiveAnalysis è implementato
  MEGA_PROMPT_ANALYSIS: true, // Come sopra
  MIN_TOPIC_QUALITY_SCORE: 0.1, // Usato potenzialmente in validazione o per filtri futuri
  MAX_TOPICS_UNLIMITED: true 
};

/**
 * @typedef {Object} ContentAnalysisInput
 * @property {string} examName - Nome dell'esame
 * @property {Array} files - Array di file PDF
 * @property {string} userDescription - Descrizione utente (opzionale)
 * @property {string} analysisMode - 'pdf' o 'text'
 * @property {function} progressCallback - Callback per progress (opzionale)
 */

/**
 * @typedef {Object} ContentAnalysisOutput
 * @property {Array} topics - Lista degli argomenti estratti
 * @property {Object} statistics - Statistiche dell'analisi
 * @property {Object} phaseResults - Risultati delle singole fasi (struttura modificata)
 * @property {boolean} success - Successo dell'operazione
 */

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
    // FASE 1: Ricerca Indice e Analisi Iniziale Completa
    progressCallback?.({ type: 'processing', message: `Fase 1: Analisi iniziale completa (${analysisMode})...` });
    const initialAnalysisResult = await executePhaseWithErrorHandling(
      'phase1-initial-analysis',
      performInitialComprehensiveAnalysis,
      { examName, files, userDescription, analysisMode, progressCallback }
    );
    phaseResults.initialAnalysis = initialAnalysisResult;
    
    // FASE 2: Processamento/Validazione Dati Analisi Pagina per Pagina
    progressCallback?.({ type: 'processing', message: 'Fase 2: Processamento dati pagina per pagina...' });
    // L'input per phase2 è l'output di phase1
    const pageAnalysisDataForSynthesis = await executePhaseWithErrorHandling(
      'phase2-page-data-processing',
      processPageByPageData,
      { initialComprehensiveAnalysisResult: initialAnalysisResult, progressCallback } 
    );
    phaseResults.pageDataProcessing = pageAnalysisDataForSynthesis; // pageAnalysisDataForSynthesis è initialAnalysisResult

    // FASE 3: Sintesi Intelligente Argomenti
    progressCallback?.({ type: 'processing', message: 'Fase 3: Sintesi intelligente argomenti...' });
    const synthesisResult = await executePhaseWithErrorHandling(
      'phase3-topic-synthesis',
      performIntelligentTopicSynthesis,
      // Usa l'output della Fase 2 (che contiene i dati della Fase 1)
      { examName, pageAnalysisResult: pageAnalysisDataForSynthesis, userDescription, progressCallback }
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
        // Passa l'output originale della Fase 1/2 per l'analisi delle pagine
        initialComprehensiveAnalysisResult: pageAnalysisDataForSynthesis, 
        examName, 
        progressCallback 
      }
    );
    phaseResults.validationAndOptimization = finalResult;
    
    const output = createContentPhaseOutput('content-analysis-orchestrator', {
      topics: finalResult.validatedTopics,
      statistics: finalResult.statistics,
      phaseResults: phaseResults // Contiene i risultati di ogni fase
    }, {
      analysisMode,
      totalFiles: files.length,
      totalTopics: finalResult.validatedTopics?.length || 0,
      totalPages: finalResult.statistics?.totalPages || 0,
      qualityScore: finalResult.validationReport?.qualityScore || 0,
      architecture: "multi-phase",
      pagesAnalyzedInInitialScan: initialAnalysisResult.pageByPageAnalysis?.length || 0
    });

    logPhase('content-analysis-orchestrator', `ANALISI COMPLETATA: ${output.data.topics.length} argomenti, ${output.data.statistics.totalPages} pagine`);
    logPhase('content-analysis-orchestrator', `QUALITÀ FINALE: ${Math.round((finalResult.validationReport?.qualityScore || 0) * 100)}%`);
    progressCallback?.({ type: 'success', message: `Analisi contenuti completata (${analysisMode})!` });
    
    return output;

  } catch (error) {
    logPhase('content-analysis-orchestrator', `ERRORE CRITICO NELL'ORCHESTRAZIONE: ${error.message}`);
    progressCallback?.({ type: 'error', message: `Errore analisi: ${error.message}` });
    // Qui potresti voler gestire il fallback in modo più granulare se una fase specifica fallisce
    // e le altre potrebbero comunque fornire risultati parziali.
    // Per ora, un errore in una fase interrompe tutto.
    
    // Tentativo di fallback se l'errore proviene dalla fase 1
    if (error.phase === 'phase1-initial-analysis' && phaseResults.initialAnalysis) {
        logPhase('content-analysis-orchestrator', 'Tentativo di fallback dopo errore in Fase 1...');
        try {
            const fallbackInitialData = await handlePartialMegaAnalysisFailure(phaseResults.initialAnalysis, input); // Usa input originale
            // Potresti provare a rieseguire le fasi successive con i dati di fallback
            // Per semplicità, qui terminiamo con i dati di fallback della fase 1
            logPhase('content-analysis-orchestrator', 'Fallback parziale completato.');
             return createContentPhaseOutput('content-analysis-orchestrator', {
                topics: [], // Nessun topic sintetizzato in questo scenario di fallback
                statistics: {totalPagesAnalyzed: fallbackInitialData.pageByPageAnalysis?.length || 0},
                phaseResults: { initialAnalysisFallback: fallbackInitialData },
                fallbackApplied: true,
            }, { analysisMode, totalFiles: files.length, notes: "Fallback applicato dopo errore Fase 1" });

        } catch (fallbackError) {
             logPhase('content-analysis-orchestrator', `Errore durante il fallback: ${fallbackError.message}`);
        }
    } else if (!files || files.length === 0) { // Fallback se non ci sono file
        logPhase('content-analysis-orchestrator', 'Nessun file fornito, generazione output minimale.');
        const minimalData = generateMinimalAnalysis(files || [], examName, analysisMode);
         return createContentPhaseOutput('content-analysis-orchestrator', {
            topics: [],
            statistics: minimalData.contentSummary,
            phaseResults: { minimalAnalysis: minimalData },
            minimalAnalysis: true,
        }, { analysisMode, totalFiles: 0, notes: "Analisi minimale causa assenza di file." });
    }

    throw createPhaseError('content-analysis-orchestrator', `Errore durante l'orchestrazione dell'analisi: ${error.message}`, error);
  }
}


// ===== FUNZIONI DI FALLBACK E RECOVERY (MANTENUTE NELL'ORCHESTRATORE) =====
async function handlePartialMegaAnalysisFailure(partialResult, originalInput) {
  logPhase('fallback-recovery', 'Gestione fallimento parziale analisi iniziale...');
  const { examName, files, analysisMode } = originalInput;
  
  if (partialResult && partialResult.globalStructure && partialResult.globalStructure.estimatedTotalPages > 0) {
    logPhase('fallback-recovery', 'Struttura globale parziale disponibile, tentativo recupero...');
    const fallbackPageAnalysis = generateFallbackPageAnalysis(partialResult.globalStructure, files, analysisMode);
    return {
      ...partialResult,
      pageByPageAnalysis: fallbackPageAnalysis,
      contentSummary: generateFallbackContentSummary(fallbackPageAnalysis),
      analysisMetadata: {
        ...(partialResult.analysisMetadata || {}),
        completeness: (partialResult.analysisMetadata?.completeness || 0.7) * 0.5, // Riduci la stima
        confidence: (partialResult.analysisMetadata?.confidence || 0.6) * 0.5,
        processingNotes: `${partialResult.analysisMetadata?.processingNotes || ''} Analisi recuperata parzialmente tramite fallback.`
      }
    };
  }
  logPhase('fallback-recovery', 'Nessuna struttura globale sufficiente, generazione analisi minimale...');
  return generateMinimalAnalysis(files, examName, analysisMode);
}

function generateFallbackPageAnalysis(globalStructure, files, analysisMode) {
  const fallbackPages = [];
  const totalEstimatedPages = globalStructure.estimatedTotalPages || (files.length > 0 ? 50 * files.length : 10); // Stima di base
  
  if (files && files.length > 0) {
    files.forEach((file, fileIndex) => {
      const pagesPerFile = Math.ceil(totalEstimatedPages / files.length);
      for (let pageNum = 1; pageNum <= pagesPerFile; pageNum++) {
        fallbackPages.push({
          fileIndex: fileIndex, fileName: file.name, pageNumber: pageNum,
          pageTitle: `Pagina ${pageNum} (fallback) - ${file.name}`,
          mainTopics: [{ topicName: `Argomento generico da p.${pageNum}`, description: `Contenuto stimato per pagina ${pageNum}`, importance: 'medium', keyPoints: [] }],
          contentType: 'mixed', difficulty: 'intermediate', estimatedStudyTime: 15,
          // ... altri campi con valori di default
        });
      }
    });
  } else if (totalEstimatedPages > 0) { // Nessun file ma pagine stimate (scenario improbabile)
     for (let pageNum = 1; pageNum <= totalEstimatedPages; pageNum++) {
        fallbackPages.push({
          fileIndex: 0, fileName: "documento_generico.pdf", pageNumber: pageNum,
          pageTitle: `Pagina ${pageNum} (fallback)`,
          mainTopics: [{ topicName: `Argomento generico da p.${pageNum}`, description: `Contenuto stimato per pagina ${pageNum}`, importance: 'medium', keyPoints: [] }],
          contentType: 'mixed', difficulty: 'intermediate', estimatedStudyTime: 15,
        });
      }
  }
  return fallbackPages;
}

function generateFallbackContentSummary(pageAnalysis) {
  const count = pageAnalysis.length;
  return {
    totalPagesAnalyzed: count,
    contentDistribution: { theory: Math.floor(count*0.5), examples: Math.floor(count*0.2), exercises: Math.floor(count*0.1), mixed: Math.floor(count*0.2) },
    difficultyBreakdown: { beginner: Math.floor(count*0.3), intermediate: Math.floor(count*0.5), advanced: Math.floor(count*0.2) },
    specialElements: { formulaPages: 0, exercisePages: 0, imagePages: 0, tablePages: 0 },
    estimatedTotalStudyTime: count * 15
  };
}

function generateMinimalAnalysis(files, examName, analysisMode) {
  logPhase('minimal-analysis', 'Generazione analisi minimale per recovery...');
  const fileCount = files?.length || 0;
  const estimatedPagesPerFile = fileCount > 0 ? 30 : 0;
  const totalEstimatedPages = fileCount * estimatedPagesPerFile;

  const mockGlobalStructure = {
    totalFiles: fileCount, materialType: 'mixed',
    overallOrganization: `Materiale per ${examName} (${fileCount} file) - Analisi Minimale`,
    estimatedTotalPages: totalEstimatedPages,
    mainSections: files?.map((f, i) => ({ sectionTitle: f.name, fileIndex: i, startPage: 1, endPage: estimatedPagesPerFile, sectionType: 'chapter', importance: 'medium', description: `File ${f.name}` })) || [],
    structuralElements: []
  };

  return {
    globalStructure: mockGlobalStructure,
    pageByPageAnalysis: generateFallbackPageAnalysis(mockGlobalStructure, files, analysisMode),
    contentSummary: generateFallbackContentSummary(generateFallbackPageAnalysis(mockGlobalStructure, files, analysisMode)), // Usa il risultato di fallback
    analysisMetadata: {
      analysisMode: analysisMode, completeness: 0.1, confidence: 0.1,
      processingNotes: 'Analisi minimale generata causa errore grave o assenza di dati iniziali.'
    }
  };
}

// Esporta le funzioni principali e la configurazione
export default {
  analyzeContent,
  MODULE_CONFIG
};