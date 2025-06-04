// src/utils/gemini/modules/contentAnalysisModule.js - ANALISI CONTENUTI SINGLE-CALL ARCHITECTURE

import { executeAIRequest, createAIServiceInput, validateAIServiceOutput } from '../services/geminiAIService.js';
import { 
  createContentPhaseInput, 
  createContentPhaseOutput, 
  validatePhaseInput,
  logPhase,
  createPhaseError,
  executePhaseWithErrorHandling
} from '../shared/geminiShared.js';

// ===== CONFIGURAZIONE MODULO - SINGLE CALL =====
const MODULE_CONFIG = {
  SINGLE_CALL_MODE: true, // Flag per indicare modalità single-call
  MEGA_PROMPT_ANALYSIS: true, // Analisi completa in una sola chiamata
  MIN_TOPIC_QUALITY_SCORE: 0.1,
  MAX_TOPICS_UNLIMITED: true // Nessun limite al numero di topic
};

// ===== INPUT/OUTPUT INTERFACES =====

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
 * @property {Object} phaseResults - Risultati delle singole fasi
 * @property {boolean} success - Successo dell'operazione
 */

// ===== SINGLE-CALL ANALYSIS =====

/**
 * MEGA-FASE: Analisi Completa Single-Call
 * INPUT: examName, files, userDescription, analysisMode
 * OUTPUT: Analisi completa pagina-per-pagina + struttura globale
 */
async function phaseMegaPageByPageAnalysis(input) {
  const { examName, files, userDescription, analysisMode, progressCallback } = input;
  
  logPhase('mega-page-analysis', `SINGLE-CALL: Analisi completa (${analysisMode} mode) - ${files.length} file`);
  
  const filesList = files
    .map((file, index) => `${index + 1}. ${file.name} (${Math.round(file.size / 1024 / 1024)} MB)`)
    .join('\n');

  const modeNote = analysisMode === 'text' 
    ? '\n\nMODALITÀ TESTO: Analizza il contenuto testuale estraendo tutte le informazioni strutturali.'
    : '\n\nMODALITÀ PDF: Analizza completamente includendo elementi visivi, grafici, formule e layout.';

  const prompt = `Sei un AI tutor esperto specializzato nell'analisi di materiale didattico per la creazione di piani di studio personalizzati.

COMPITO: Analizza COMPLETAMENTE questo materiale per l'esame "${examName}" e restituisci UN SINGOLO JSON strutturato con tutte le informazioni necessarie.

FILE DA ANALIZZARE:
${filesList}

${userDescription ? `OBIETTIVI SPECIFICI: "${userDescription}"` : ''}${modeNote}

DEVI FORNIRE:
1. Mappatura struttura globale del documento
2. Analisi dettagliata di OGNI SINGOLA PAGINA/SEZIONE
3. Identificazione di tutti gli elementi strutturali

REGOLE FONDAMENTALI:
- Analizza OGNI pagina, non saltarne nessuna
- Sii ESTREMAMENTE dettagliato nella mappatura
- Identifica OGNI elemento strutturale visibile
- NON limitare il numero di pagine o sezioni analizzate
- Mantieni precisione assoluta sui numeri di pagina

JSON RICHIESTO:

{
  "globalStructure": {
    "totalFiles": ${files.length},
    "materialType": "textbook|slides|notes|mixed|exercises",
    "overallOrganization": "descrizione dettagliata dell'organizzazione generale",
    "estimatedTotalPages": 0,
    "mainSections": [
      {
        "sectionTitle": "Nome sezione principale",
        "fileIndex": 0,
        "startPage": 1,
        "endPage": 25,
        "sectionType": "introduction|chapter|appendix|exercises|index",
        "importance": "high|medium|low",
        "description": "Descrizione dettagliata del contenuto"
      }
    ],
    "structuralElements": [
      {
        "type": "index|chapter|section|appendix|exercises|formulas",
        "title": "Nome elemento",
        "fileIndex": 0,
        "startPage": 1,
        "endPage": 5,
        "confidence": "high|medium|low",
        "description": "Descrizione dettagliata"
      }
    ]
  },
  "pageByPageAnalysis": [
    {
      "fileIndex": 0,
      "fileName": "nome.pdf",
      "pageNumber": 1,
      "pageTitle": "titolo della pagina o sezione (se identificabile)",
      "mainTopics": [
        {
          "topicName": "Nome specifico argomento",
          "description": "Descrizione dettagliata dell'argomento",
          "importance": "high|medium|low",
          "keyPoints": ["punto chiave 1", "punto chiave 2", "punto chiave 3"]
        }
      ],
      "contentType": "theory|examples|exercises|mixed|index|appendix",
      "difficulty": "beginner|intermediate|advanced",
      "hasFormulas": true,
      "hasExercises": false,
      "hasImages": false,
      "hasTables": false,
      "estimatedStudyTime": 30,
      "conceptDensity": "low|medium|high",
      "prerequisites": ["prerequisito1", "prerequisito2"],
      "keyTerms": ["termine1", "termine2", "termine3"],
      "connections": ["collegamenti con altre pagine o concetti"],
      "studyNotes": "Note specifiche su come studiare questa pagina"
    }
  ],
  "contentSummary": {
    "totalPagesAnalyzed": 0,
    "contentDistribution": {
      "theory": 0,
      "examples": 0, 
      "exercises": 0,
      "mixed": 0
    },
    "difficultyBreakdown": {
      "beginner": 0,
      "intermediate": 0,
      "advanced": 0
    },
    "specialElements": {
      "formulaPages": 0,
      "exercisePages": 0,
      "imagePages": 0,
      "tablePages": 0
    },
    "estimatedTotalStudyTime": 0
  },
  "analysisMetadata": {
    "analysisMode": "${analysisMode}",
    "completeness": "0.0-1.0",
    "confidence": "0.0-1.0",
    "processingNotes": "Note sul processo di analisi"
  }
}

IMPORTANTE: 
- Il campo "pageByPageAnalysis" deve contenere una entry per OGNI pagina di OGNI file
- Numera le pagine in modo preciso e sequenziale
- Se una pagina contiene più argomenti, includili tutti in "mainTopics"
- Mantieni coerenza tra i numeri di pagina in globalStructure e pageByPageAnalysis
- Sii specifico e dettagliato in ogni descrizione
- Non tralasciare nessuna pagina, anche se sembra "vuota" o "di transizione"`;

  const aiInput = createAIServiceInput(prompt, files, analysisMode, 'mega-page-analysis', progressCallback);
  const result = await executeAIRequest(aiInput);
  
  validateAIServiceOutput(result, ['globalStructure', 'pageByPageAnalysis', 'contentSummary']);
  
  const analysisData = result.data;
  const pagesAnalyzed = analysisData.pageByPageAnalysis?.length || 0;
  
  logPhase('mega-page-analysis', `SINGLE-CALL completata: ${pagesAnalyzed} pagine analizzate`);
  return analysisData;
}

/**
 * FASE 2: Sintesi Intelligente degli Argomenti (basata su analisi completa)
 * INPUT: examName, megaAnalysisResult, userDescription
 * OUTPUT: Argomenti sintetizzati basati su analisi reale delle pagine
 */
async function phaseIntelligentTopicSynthesis(input) {
  const { examName, megaAnalysisResult, userDescription, progressCallback } = input;
  
  logPhase('intelligent-topic-synthesis', `Sintesi da ${megaAnalysisResult.pageByPageAnalysis?.length || 0} pagine analizzate`);
  
  const pageAnalysisData = megaAnalysisResult.pageByPageAnalysis || [];
  const globalStructure = megaAnalysisResult.globalStructure || {};
  
  if (pageAnalysisData.length === 0) {
    throw new Error('Nessuna analisi pagina-per-pagina disponibile per la sintesi');
  }

  // Prepara i dati dell'analisi per la sintesi
  const analysisDataJson = JSON.stringify({
    globalStructure: globalStructure,
    pageAnalysis: pageAnalysisData.slice(0, 200), // Limita per dimensione prompt se necessario
    contentSummary: megaAnalysisResult.contentSummary
  }, null, 2);

  const prompt = `SINTESI INTELLIGENTE ARGOMENTI per l'esame "${examName}":

DATI ANALISI COMPLETA DELLE PAGINE:
${analysisDataJson}

${userDescription ? `OBIETTIVI UTENTE: "${userDescription}"` : ''}

COMPITO: Sintetizza l'analisi pagina-per-pagina in argomenti di studio coerenti e logici.

PRINCIPI DI SINTESI INTELLIGENTE:
1. **RAGGRUPPA** pagine correlate che appartengono allo stesso macro-argomento
2. **MANTIENI** granularità appropriata (né troppo generici né troppo specifici)
3. **RISPETTA** le transizioni naturali identificate nell'analisi
4. **PRESERVA** i riferimenti esatti alle pagine dall'analisi
5. **ORDINA** secondo sequenza logica di apprendimento
6. **BILANCIA** il carico di studio per argomento

REGOLE INTELLIGENTI:
- Se un concetto appare in più pagine consecutive, crea UN argomento che le include
- Se una pagina contiene concetti molto diversi, considera di suddividerla
- Mantieni argomenti tra 5-30 pagine quando possibile
- Priorità alle pagine con importance="high"
- Considera la difficulty per la sequenza di studio
- Collega prerequisiti identificati nell'analisi

FORMATO DETTAGLIATO:

{
  "synthesizedTopics": [
    {
      "id": "topic_001",
      "title": "Titolo argomento sintetizzato basato su analisi reale",
      "description": "Descrizione completa che spiega cosa copre questo argomento",
      "pages_info": [
        {
          "pdf_index": 0,
          "original_filename": "filename.pdf",
          "start_page": 5,
          "end_page": 18,
          "content_notes": "Note specifiche su cosa si trova in queste pagine dall'analisi"
        }
      ],
      "totalPages": 14,
      "priority": "high|medium|low",
      "difficulty": "beginner|intermediate|advanced",
      "estimatedHours": 4,
      "learningObjectives": [
        "Obiettivo apprendimento basato su analisi reale 1",
        "Obiettivo apprendimento basato su analisi reale 2"
      ],
      "keyConcepts": ["concetto estratto dall'analisi", "concetto2", "concetto3"],
      "hasExercises": true,
      "hasFormulas": false,
      "studyTips": "Suggerimenti basati su analisi reale delle pagine",
      "prerequisites": ["prerequisiti identificati nell'analisi"],
      "synthesisNotes": "Note su come questo argomento è stato creato dall'analisi",
      "qualityScore": "0.0-1.0",
      "sourcePages": [
        {
          "fileIndex": 0,
          "pageNumber": 5,
          "mainTopicsFromAnalysis": ["topic dal pageByPageAnalysis"],
          "contentType": "theory|examples|exercises",
          "importance": "high|medium|low"
        }
      ]
    }
  ],
  "synthesisStatistics": {
    "originalPages": ${pageAnalysisData.length},
    "synthesizedTopics": 0,
    "totalPagesAssigned": 0,
    "averagePagesPerTopic": 0,
    "coveragePercentage": "0.0-1.0",
    "synthesisStrategy": "Strategia utilizzata per la sintesi"
  },
  "qualityMetrics": {
    "coverage": "percentuale di contenuto coperto dalla sintesi",
    "coherence": "coerenza degli argomenti sintetizzati",
    "balance": "bilanciamento del carico di studio",
    "overallQuality": "0.0-1.0"
  },
  "synthesisMetadata": {
    "basedOnPages": ${pageAnalysisData.length},
    "processingNotes": "Note sul processo di sintesi",
    "qualityAssurance": "Controlli di qualità applicati"
  }
}

IMPORTANTE: 
- Ogni pagina deve apparire in MASSIMO un argomento
- Non lasciare "buchi" nel materiale
- Mantieni il collegamento preciso con l'analisi pagina-per-pagina
- Ogni argomento deve avere un valore educativo chiaro
- I numeri di pagina devono corrispondere ESATTAMENTE all'analisi iniziale`;

  const aiInput = createAIServiceInput(prompt, [], 'text', 'intelligent-topic-synthesis', progressCallback);
  const result = await executeAIRequest(aiInput);
  
  validateAIServiceOutput(result, ['synthesizedTopics']);
  
  const synthesizedTopics = result.data.synthesizedTopics || [];
  logPhase('intelligent-topic-synthesis', `Sintesi completata: ${synthesizedTopics.length} argomenti finali`);
  
  return result.data;
}

/**
 * FASE 3: Validazione e Ottimizzazione Finale
 * INPUT: synthesisResult, files, megaAnalysisResult
 * OUTPUT: Argomenti validati, ottimizzati e corretti
 */
async function phaseFinalValidationAndOptimization(input) {
  const { synthesisResult, files, megaAnalysisResult, examName, progressCallback } = input;
  
  logPhase('final-validation', `Validazione finale ${synthesisResult.synthesizedTopics?.length || 0} argomenti`);
  
  const topics = synthesisResult.synthesizedTopics || [];
  const originalPageAnalysis = megaAnalysisResult.pageByPageAnalysis || [];
  
  // Validazione automatica approfondita basata sull'analisi completa
  const validatedTopics = await performDeepValidationWithPageAnalysis(topics, files, originalPageAnalysis);
  
  // Ottimizzazione intelligente con contesto dell'analisi completa
  const optimizedTopics = await performIntelligentOptimizationWithContext(validatedTopics, files, originalPageAnalysis);
  
  // Statistiche finali complete
  const finalStats = calculateComprehensiveStatisticsWithAnalysis(optimizedTopics, originalPageAnalysis);
  
  logPhase('final-validation', `Validazione completata: ${optimizedTopics.length} argomenti finali ottimizzati`);
  
  return {
    validatedTopics: optimizedTopics,
    statistics: finalStats,
    validationReport: {
      originalCount: topics.length,
      validatedCount: optimizedTopics.length,
      optimizationsApplied: optimizedTopics.length !== topics.length,
      qualityScore: calculateQualityScore(optimizedTopics),
      pageAnalysisIntegration: true
    },
    originalSynthesis: synthesisResult,
    pageAnalysisBase: {
      totalPagesAnalyzed: originalPageAnalysis.length,
      analysisQuality: calculateAnalysisQuality(originalPageAnalysis)
    }
  };
}

// ===== FUNZIONI DI SUPPORTO AVANZATE =====

/**
 * Validazione approfondita con analisi pagina-per-pagina
 */
async function performDeepValidationWithPageAnalysis(topics, files, pageAnalysis) {
  logPhase('deep-validation', `Validazione con analisi di ${pageAnalysis.length} pagine...`);
  
  const validatedTopics = [];
  const pageAssignments = new Map(); // Traccia assegnazioni pagine per file
  
  // Crea mappa delle pagine analizzate per reference
  const pageAnalysisMap = new Map();
  pageAnalysis.forEach(page => {
    const key = `${page.fileIndex}-${page.pageNumber}`;
    pageAnalysisMap.set(key, page);
  });
  
  for (const topic of topics) {
    // Validazione base
    if (!topic.title || !topic.pages_info || topic.pages_info.length === 0) {
      logPhase('deep-validation', `Scartato "${topic.title}" - dati insufficienti`);
      continue;
    }
    
    // Validazione pages_info con cross-reference all'analisi
    const validPagesInfo = [];
    let totalValidPages = 0;
    
    for (const pInfo of topic.pages_info) {
      const fileIndex = pInfo.pdf_index;
      
      // Verifica che il file esista
      if (fileIndex < 0 || fileIndex >= files.length) {
        logPhase('deep-validation', `Pagine ignorate - file index ${fileIndex} non valido`);
        continue;
      }
      
      // Verifica ragionevolezza delle pagine
      const startPage = Math.max(1, pInfo.start_page);
      const endPage = Math.max(startPage, pInfo.end_page);
      
      // Cross-check con analisi pagina-per-pagina
      let validatedPageRange = { start: startPage, end: endPage };
      let analysisConfirmed = false;
      
      for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
        const analysisKey = `${fileIndex}-${pageNum}`;
        if (pageAnalysisMap.has(analysisKey)) {
          analysisConfirmed = true;
          break;
        }
      }
      
      if (!analysisConfirmed) {
        logPhase('deep-validation', `Range ${startPage}-${endPage} non trovato nell'analisi - tentativo correzione`);
        // Tenta di trovare pagine vicine nell'analisi
        validatedPageRange = findNearestAnalyzedPages(fileIndex, startPage, endPage, pageAnalysisMap);
      }
      
      // Verifica sovrapposizioni
      const filePageMap = pageAssignments.get(fileIndex) || new Set();
      let hasOverlap = false;
      
      for (let pageNum = validatedPageRange.start; pageNum <= validatedPageRange.end; pageNum++) {
        if (filePageMap.has(pageNum)) {
          hasOverlap = true;
          break;
        }
      }
      
      if (!hasOverlap) {
        // Registra le pagine come assegnate
        for (let pageNum = validatedPageRange.start; pageNum <= validatedPageRange.end; pageNum++) {
          filePageMap.add(pageNum);
        }
        pageAssignments.set(fileIndex, filePageMap);
        
        // Arricchisci con dati dall'analisi
        const enrichedPagesInfo = enrichPagesInfoWithAnalysis(
          validatedPageRange, 
          fileIndex, 
          files[fileIndex].name, 
          pageAnalysisMap
        );
        
        validPagesInfo.push(enrichedPagesInfo);
        totalValidPages += (validatedPageRange.end - validatedPageRange.start + 1);
      } else {
        logPhase('deep-validation', `Sovrapposizione detectata per "${topic.title}" pagine ${validatedPageRange.start}-${validatedPageRange.end}`);
      }
    }
    
    // Accetta topic solo se ha pagine valide
    if (validPagesInfo.length > 0 && totalValidPages >= 3) {
      const enrichedTopic = enrichTopicWithAnalysis(topic, validPagesInfo, pageAnalysisMap);
      
      validatedTopics.push({
        ...enrichedTopic,
        pages_info: validPagesInfo,
        totalPages: totalValidPages,
        // Arricchisci con metadati di validazione
        validation: {
          originalPagesInfo: topic.pages_info.length,
          validPagesInfo: validPagesInfo.length,
          totalValidPages: totalValidPages,
          qualityScore: calculateTopicQualityScore(enrichedTopic, totalValidPages),
          analysisIntegration: true
        }
      });
      
      logPhase('deep-validation', `Validato "${topic.title}" - ${totalValidPages} pagine (con analisi)`);
    } else {
      logPhase('deep-validation', `Scartato "${topic.title}" - pagine insufficienti`);
    }
  }
  
  logPhase('deep-validation', `Validazione completata: ${validatedTopics.length}/${topics.length} argomenti validi`);
  return validatedTopics;
}

/**
 * Trova pagine analizzate più vicine al range richiesto
 */
function findNearestAnalyzedPages(fileIndex, startPage, endPage, pageAnalysisMap) {
  let nearestStart = startPage;
  let nearestEnd = endPage;
  
  // Cerca la pagina analizzata più vicina all'inizio
  for (let offset = 0; offset <= 5; offset++) {
    const checkStart = startPage - offset;
    const checkEnd = startPage + offset;
    
    if (checkStart > 0 && pageAnalysisMap.has(`${fileIndex}-${checkStart}`)) {
      nearestStart = checkStart;
      break;
    }
    if (pageAnalysisMap.has(`${fileIndex}-${checkEnd}`)) {
      nearestStart = checkEnd;
      break;
    }
  }
  
  // Cerca la pagina analizzata più vicina alla fine
  for (let offset = 0; offset <= 5; offset++) {
    const checkStart = endPage - offset;
    const checkEnd = endPage + offset;
    
    if (pageAnalysisMap.has(`${fileIndex}-${checkEnd}`)) {
      nearestEnd = checkEnd;
      break;
    }
    if (checkStart > 0 && pageAnalysisMap.has(`${fileIndex}-${checkStart}`)) {
      nearestEnd = checkStart;
      break;
    }
  }
  
  return { start: nearestStart, end: Math.max(nearestStart, nearestEnd) };
}

/**
 * Arricchisce pages_info con dati dall'analisi
 */
function enrichPagesInfoWithAnalysis(pageRange, fileIndex, fileName, pageAnalysisMap) {
  const enrichedInfo = {
    pdf_index: fileIndex,
    original_filename: fileName,
    start_page: pageRange.start,
    end_page: pageRange.end,
    content_notes: "Note specifiche su cosa si trova in queste pagine"
  };
  
  // Colleziona informazioni dall'analisi per questo range
  const pageContentSummary = [];
  const difficulties = [];
  const contentTypes = [];
  let hasFormulas = false;
  let hasExercises = false;
  
  for (let pageNum = pageRange.start; pageNum <= pageRange.end; pageNum++) {
    const analysisKey = `${fileIndex}-${pageNum}`;
    const pageAnalysis = pageAnalysisMap.get(analysisKey);
    
    if (pageAnalysis) {
      if (pageAnalysis.pageTitle) {
        pageContentSummary.push(`P.${pageNum}: ${pageAnalysis.pageTitle}`);
      }
      if (pageAnalysis.difficulty) {
        difficulties.push(pageAnalysis.difficulty);
      }
      if (pageAnalysis.contentType) {
        contentTypes.push(pageAnalysis.contentType);
      }
      if (pageAnalysis.hasFormulas) hasFormulas = true;
      if (pageAnalysis.hasExercises) hasExercises = true;
    }
  }
  
  // Genera note di contenuto basate sull'analisi
  if (pageContentSummary.length > 0) {
    enrichedInfo.content_notes = pageContentSummary.slice(0, 3).join('; ');
  }
  
  // Aggiungi metadati dall'analisi
  enrichedInfo.analysisMetadata = {
    averageDifficulty: calculateAverageDifficulty(difficulties),
    primaryContentType: findMostCommon(contentTypes),
    hasFormulas: hasFormulas,
    hasExercises: hasExercises,
    analysisConfidence: difficulties.length / (pageRange.end - pageRange.start + 1)
  };
  
  return enrichedInfo;
}

/**
 * Arricchisce topic con dati dall'analisi
 */
function enrichTopicWithAnalysis(topic, validPagesInfo, pageAnalysisMap) {
  const enrichedTopic = { ...topic };
  
  // Colleziona tutti i concetti chiave dalle pagine analizzate
  const allKeyConcepts = new Set(topic.keyConcepts || []);
  const allKeyTerms = new Set();
  const allPrerequisites = new Set(topic.prerequisites || []);
  let totalStudyTime = 0;
  let hasFormulasInAnalysis = false;
  let hasExercisesInAnalysis = false;
  
  validPagesInfo.forEach(pInfo => {
    for (let pageNum = pInfo.start_page; pageNum <= pInfo.end_page; pageNum++) {
      const analysisKey = `${pInfo.pdf_index}-${pageNum}`;
      const pageAnalysis = pageAnalysisMap.get(analysisKey);
      
      if (pageAnalysis) {
        // Aggiungi concetti e termini
        if (pageAnalysis.mainTopics) {
          pageAnalysis.mainTopics.forEach(mainTopic => {
            if (mainTopic.keyPoints) {
              mainTopic.keyPoints.forEach(point => allKeyConcepts.add(point));
            }
          });
        }
        
        if (pageAnalysis.keyTerms) {
          pageAnalysis.keyTerms.forEach(term => allKeyTerms.add(term));
        }
        
        if (pageAnalysis.prerequisites) {
          pageAnalysis.prerequisites.forEach(prereq => allPrerequisites.add(prereq));
        }
        
        // Accumula tempo di studio
        if (pageAnalysis.estimatedStudyTime) {
          totalStudyTime += pageAnalysis.estimatedStudyTime;
        }
        
        // Verifica presenza di formule ed esercizi
        if (pageAnalysis.hasFormulas) hasFormulasInAnalysis = true;
        if (pageAnalysis.hasExercises) hasExercisesInAnalysis = true;
      }
    }
  });
  
  // Aggiorna il topic con informazioni arricchite
  enrichedTopic.keyConcepts = Array.from(allKeyConcepts).slice(0, 10); // Limita a 10 più importanti
  enrichedTopic.keyTerms = Array.from(allKeyTerms).slice(0, 8);
  enrichedTopic.prerequisites = Array.from(allPrerequisites);
  enrichedTopic.estimatedHours = Math.max(
    enrichedTopic.estimatedHours || 0, 
    Math.ceil(totalStudyTime / 60) // Converti minuti in ore
  );
  enrichedTopic.hasFormulas = enrichedTopic.hasFormulas || hasFormulasInAnalysis;
  enrichedTopic.hasExercises = enrichedTopic.hasExercises || hasExercisesInAnalysis;
  
  // Migliora studyTips basandosi sull'analisi
  if (hasFormulasInAnalysis && hasExercisesInAnalysis) {
    enrichedTopic.studyTips = `${enrichedTopic.studyTips} FOCUS: Argomento con formule ed esercizi - dedica tempo extra alla pratica.`;
  } else if (hasFormulasInAnalysis) {
    enrichedTopic.studyTips = `${enrichedTopic.studyTips} FOCUS: Argomento con formule - pratica derivazioni e applicazioni.`;
  } else if (hasExercisesInAnalysis) {
    enrichedTopic.studyTips = `${enrichedTopic.studyTips} FOCUS: Argomento con esercizi - risolvi attivamente i problemi.`;
  }
  
  return enrichedTopic;
}

/**
 * Ottimizzazione intelligente con contesto dell'analisi
 */
async function performIntelligentOptimizationWithContext(topics, files, pageAnalysis) {
  logPhase('intelligent-optimization', `Ottimizzazione con contesto di ${pageAnalysis.length} pagine analizzate...`);
  
  let optimizedTopics = [...topics];
  
  // 1. Unisci argomenti troppo piccoli basandosi su analisi di contenuto
  optimizedTopics = mergeSmallTopicsWithAnalysis(optimizedTopics, pageAnalysis);
  
  // 2. Suddividi argomenti troppo grandi se l'analisi mostra chiare divisioni
  optimizedTopics = splitLargeTopicsWithAnalysis(optimizedTopics, pageAnalysis);
  
  // 3. Riordina per sequenza logica ottimale basata su prerequisiti dell'analisi
  optimizedTopics = reorderTopicsLogicallyWithAnalysis(optimizedTopics, pageAnalysis);
  
  // 4. Ottimizza priorità e difficoltà basandosi sull'analisi reale
  optimizedTopics = optimizePriorityAndDifficultyWithAnalysis(optimizedTopics, pageAnalysis);
  
  logPhase('intelligent-optimization', `Ottimizzazione completata: ${optimizedTopics.length} argomenti finali`);
  return optimizedTopics;
}

/**
 * Unisce argomenti troppo piccoli basandosi su analisi di contenuto
 */
function mergeSmallTopicsWithAnalysis(topics, pageAnalysis) {
  const MIN_PAGES = 5;
  const mergedTopics = [];
  let pendingSmallTopic = null;
  
  // Crea mappa dell'analisi per reference veloce
  const pageAnalysisMap = new Map();
  pageAnalysis.forEach(page => {
    const key = `${page.fileIndex}-${page.pageNumber}`;
    pageAnalysisMap.set(key, page);
  });
  
  for (const topic of topics) {
    if (topic.totalPages < MIN_PAGES) {
      if (pendingSmallTopic && areTopicsRelatedByAnalysis(pendingSmallTopic, topic, pageAnalysisMap)) {
        // Unisci con il topic piccolo precedente
        const mergedTopic = {
          ...pendingSmallTopic,
          title: `${pendingSmallTopic.title} e ${topic.title}`,
          description: `${pendingSmallTopic.description} Include anche: ${topic.description}`,
          pages_info: [...pendingSmallTopic.pages_info, ...topic.pages_info],
          totalPages: pendingSmallTopic.totalPages + topic.totalPages,
          keyConcepts: [...(pendingSmallTopic.keyConcepts || []), ...(topic.keyConcepts || [])],
          estimatedHours: (pendingSmallTopic.estimatedHours || 0) + (topic.estimatedHours || 0),
          mergedFromAnalysis: true
        };
        
        mergedTopics.push(mergedTopic);
        pendingSmallTopic = null;
        logPhase('optimization', `Uniti "${pendingSmallTopic?.title}" e "${topic.title}" (basato su analisi)`);
      } else {
        // Mantieni per possibile unione futura
        if (pendingSmallTopic) {
          mergedTopics.push(pendingSmallTopic);
        }
        pendingSmallTopic = topic;
      }
    } else {
      // Topic di dimensione normale
      if (pendingSmallTopic) {
        mergedTopics.push(pendingSmallTopic);
        pendingSmallTopic = null;
      }
      mergedTopics.push(topic);
    }
  }
  
  // Aggiungi l'ultimo topic piccolo rimasto
  if (pendingSmallTopic) {
    mergedTopics.push(pendingSmallTopic);
  }
  
  return mergedTopics;
}

/**
 * Verifica se due argomenti sono correlati basandosi sull'analisi delle pagine
 */
function areTopicsRelatedByAnalysis(topic1, topic2, pageAnalysisMap) {
  // Estrai i concetti principali dalle pagine di entrambi i topic
  const concepts1 = extractConceptsFromTopicPages(topic1, pageAnalysisMap);
  const concepts2 = extractConceptsFromTopicPages(topic2, pageAnalysisMap);
  
  // Calcola intersezione concetti
  const intersection = new Set([...concepts1].filter(x => concepts2.has(x)));
  const union = new Set([...concepts1, ...concepts2]);
  
  // Se condividono >40% dei concetti dall'analisi, sono correlati
  return union.size > 0 && (intersection.size / union.size) > 0.4;
}

/**
 * Estrae concetti dalle pagine di un topic basandosi sull'analisi
 */
function extractConceptsFromTopicPages(topic, pageAnalysisMap) {
  const concepts = new Set();
  
  topic.pages_info?.forEach(pInfo => {
    for (let pageNum = pInfo.start_page; pageNum <= pInfo.end_page; pageNum++) {
      const analysisKey = `${pInfo.pdf_index}-${pageNum}`;
      const pageAnalysis = pageAnalysisMap.get(analysisKey);
      
      if (pageAnalysis) {
        // Aggiungi concetti dai mainTopics
        pageAnalysis.mainTopics?.forEach(mainTopic => {
          if (mainTopic.keyPoints) {
            mainTopic.keyPoints.forEach(point => concepts.add(point.toLowerCase()));
          }
        });
        
        // Aggiungi key terms
        pageAnalysis.keyTerms?.forEach(term => concepts.add(term.toLowerCase()));
        
        // Aggiungi concetti dal titolo della pagina
        if (pageAnalysis.pageTitle) {
          pageAnalysis.pageTitle.split(' ').forEach(word => {
            if (word.length > 3) concepts.add(word.toLowerCase());
          });
        }
      }
    }
  });
  
  return concepts;
}

/**
 * Suddivide argomenti troppo grandi basandosi su analisi di contenuto
 */
function splitLargeTopicsWithAnalysis(topics, pageAnalysis) {
  const MAX_PAGES = 35;
  const splitTopics = [];
  
  // Crea mappa dell'analisi per reference veloce
  const pageAnalysisMap = new Map();
  pageAnalysis.forEach(page => {
    const key = `${page.fileIndex}-${page.pageNumber}`;
    pageAnalysisMap.set(key, page);
  });
  
  for (const topic of topics) {
    if (topic.totalPages > MAX_PAGES && topic.pages_info.length > 1) {
      // Analizza se ci sono divisioni naturali nell'analisi
      const naturalBreaks = findNaturalBreaksInAnalysis(topic, pageAnalysisMap);
      
      if (naturalBreaks.length > 0) {
        // Suddividi secondo le divisioni naturali trovate
        const parts = createTopicPartsFromBreaks(topic, naturalBreaks);
        splitTopics.push(...parts);
        logPhase('optimization', `Suddiviso "${topic.title}" in ${parts.length} parti (basato su analisi)`);
      } else {
        // Suddivisione semplice a metà se non ci sono divisioni naturali
        const midPoint = Math.floor(topic.pages_info.length / 2);
        
        const firstHalf = {
          ...topic,
          id: topic.id + '_part1',
          title: `${topic.title} - Parte 1`,
          pages_info: topic.pages_info.slice(0, midPoint),
          totalPages: topic.pages_info.slice(0, midPoint).reduce((sum, p) => sum + (p.end_page - p.start_page + 1), 0)
        };
        
        const secondHalf = {
          ...topic,
          id: topic.id + '_part2',
          title: `${topic.title} - Parte 2`,
          pages_info: topic.pages_info.slice(midPoint),
          totalPages: topic.pages_info.slice(midPoint).reduce((sum, p) => sum + (p.end_page - p.start_page + 1), 0)
        };
        
        splitTopics.push(firstHalf, secondHalf);
        logPhase('optimization', `Suddiviso "${topic.title}" in 2 parti (divisione semplice)`);
      }
    } else {
      splitTopics.push(topic);
    }
  }
  
  return splitTopics;
}

/**
 * Trova divisioni naturali nell'analisi di un topic
 */
function findNaturalBreaksInAnalysis(topic, pageAnalysisMap) {
  const breaks = [];
  const allPages = [];
  
  // Colleziona tutte le pagine del topic
  topic.pages_info.forEach(pInfo => {
    for (let pageNum = pInfo.start_page; pageNum <= pInfo.end_page; pageNum++) {
      allPages.push({ fileIndex: pInfo.pdf_index, pageNumber: pageNum });
    }
  });
  
  // Analizza transizioni tra pagine consecutive
  for (let i = 0; i < allPages.length - 1; i++) {
    const currentPage = allPages[i];
    const nextPage = allPages[i + 1];
    
    const currentAnalysis = pageAnalysisMap.get(`${currentPage.fileIndex}-${currentPage.pageNumber}`);
    const nextAnalysis = pageAnalysisMap.get(`${nextPage.fileIndex}-${nextPage.pageNumber}`);
    
    if (currentAnalysis && nextAnalysis) {
      // Verifica se c'è un cambiamento significativo
      const hasContentTypeChange = currentAnalysis.contentType !== nextAnalysis.contentType;
      const hasDifficultyChange = currentAnalysis.difficulty !== nextAnalysis.difficulty;
      const hasTopicChange = !doMainTopicsOverlap(currentAnalysis.mainTopics, nextAnalysis.mainTopics);
      
      // Se ci sono cambiamenti significativi, considera come possibile break
      if ((hasContentTypeChange && hasDifficultyChange) || hasTopicChange) {
        breaks.push({
          position: i + 1,
          reason: hasTopicChange ? 'topic_change' : 'content_type_change',
          confidence: hasTopicChange ? 0.9 : 0.7
        });
      }
    }
  }
  
  // Filtra break con confidence alta e posizioni sensate
  return breaks.filter(b => b.confidence > 0.8 && b.position > allPages.length * 0.3 && b.position < allPages.length * 0.7);
}

/**
 * Verifica se i mainTopics di due pagine si sovrappongono
 */
function doMainTopicsOverlap(topics1, topics2) {
  if (!topics1 || !topics2 || topics1.length === 0 || topics2.length === 0) {
    return false;
  }
  
  const names1 = new Set(topics1.map(t => t.topicName?.toLowerCase()));
  const names2 = new Set(topics2.map(t => t.topicName?.toLowerCase()));
  
  const intersection = new Set([...names1].filter(x => names2.has(x)));
  return intersection.size > 0;
}

/**
 * Crea parti del topic basandosi sui break trovati
 */
function createTopicPartsFromBreaks(topic, breaks) {
  const parts = [];
  const allPagesInfo = [...topic.pages_info];
  
  let currentStart = 0;
  breaks.forEach((breakPoint, index) => {
    const endIndex = Math.min(breakPoint.position, allPagesInfo.length);
    
    if (endIndex > currentStart) {
      const partPagesInfo = allPagesInfo.slice(currentStart, endIndex);
      const totalPages = partPagesInfo.reduce((sum, p) => sum + (p.end_page - p.start_page + 1), 0);
      
      parts.push({
        ...topic,
        id: `${topic.id}_part${index + 1}`,
        title: `${topic.title} - Parte ${index + 1}`,
        pages_info: partPagesInfo,
        totalPages: totalPages,
        splitReason: breakPoint.reason
      });
    }
    
    currentStart = endIndex;
  });
  
  // Aggiungi l'ultima parte
  if (currentStart < allPagesInfo.length) {
    const partPagesInfo = allPagesInfo.slice(currentStart);
    const totalPages = partPagesInfo.reduce((sum, p) => sum + (p.end_page - p.start_page + 1), 0);
    
    parts.push({
      ...topic,
      id: `${topic.id}_part${parts.length + 1}`,
      title: `${topic.title} - Parte ${parts.length + 1}`,
      pages_info: partPagesInfo,
      totalPages: totalPages,
      splitReason: 'remainder'
    });
  }
  
  return parts;
}

/**
 * Riordina argomenti per sequenza logica basata su analisi
 */
function reorderTopicsLogicallyWithAnalysis(topics, pageAnalysis) {
  // Crea mappa dei prerequisiti basata sull'analisi
  const prerequisiteMap = buildPrerequisiteMapFromAnalysis(topics, pageAnalysis);
  
  return topics.sort((a, b) => {
    // Prima i prerequisiti (basati su analisi reale)
    if (prerequisiteMap.has(a.title) && prerequisiteMap.get(a.title).includes(b.title)) return 1;
    if (prerequisiteMap.has(b.title) && prerequisiteMap.get(b.title).includes(a.title)) return -1;
    
    // Poi per difficulty dall'analisi
    const aDifficulty = getTopicDifficultyFromAnalysis(a, pageAnalysis);
    const bDifficulty = getTopicDifficultyFromAnalysis(b, pageAnalysis);
    
    const difficultyOrder = { beginner: 0, intermediate: 1, advanced: 2 };
    if (aDifficulty !== bDifficulty) {
      return (difficultyOrder[aDifficulty] || 1) - (difficultyOrder[bDifficulty] || 1);
    }
    
    // Poi per pagina di inizio
    const aFirstPage = Math.min(...a.pages_info.map(p => p.start_page));
    const bFirstPage = Math.min(...b.pages_info.map(p => p.start_page));
    
    if (aFirstPage !== bFirstPage) return aFirstPage - bFirstPage;
    
    // Infine per priorità
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1);
  });
}

/**
 * Costruisce mappa dei prerequisiti dall'analisi
 */
function buildPrerequisiteMapFromAnalysis(topics, pageAnalysis) {
  const prerequisiteMap = new Map();
  
  // Crea mappa dell'analisi per reference veloce
  const pageAnalysisMap = new Map();
  pageAnalysis.forEach(page => {
    const key = `${page.fileIndex}-${page.pageNumber}`;
    pageAnalysisMap.set(key, page);
  });
  
  topics.forEach(topic => {
    const prerequisites = new Set();
    
    // Estrai prerequisiti dalle pagine del topic
    topic.pages_info?.forEach(pInfo => {
      for (let pageNum = pInfo.start_page; pageNum <= pInfo.end_page; pageNum++) {
        const analysisKey = `${pInfo.pdf_index}-${pageNum}`;
        const pageAnalysis = pageAnalysisMap.get(analysisKey);
        
        if (pageAnalysis && pageAnalysis.prerequisites) {
          pageAnalysis.prerequisites.forEach(prereq => prerequisites.add(prereq));
        }
      }
    });
    
    if (prerequisites.size > 0) {
      prerequisiteMap.set(topic.title, Array.from(prerequisites));
    }
  });
  
  return prerequisiteMap;
}

/**
 * Ottiene difficoltà del topic dall'analisi delle sue pagine
 */
function getTopicDifficultyFromAnalysis(topic, pageAnalysis) {
  const pageAnalysisMap = new Map();
  pageAnalysis.forEach(page => {
    const key = `${page.fileIndex}-${page.pageNumber}`;
    pageAnalysisMap.set(key, page);
  });
  
  const difficulties = [];
  
  topic.pages_info?.forEach(pInfo => {
    for (let pageNum = pInfo.start_page; pageNum <= pInfo.end_page; pageNum++) {
      const analysisKey = `${pInfo.pdf_index}-${pageNum}`;
      const pageAnalysis = pageAnalysisMap.get(analysisKey);
      
      if (pageAnalysis && pageAnalysis.difficulty) {
        difficulties.push(pageAnalysis.difficulty);
      }
    }
  });
  
  return calculateAverageDifficulty(difficulties);
}

/**
 * Ottimizza priorità e difficoltà basandosi sull'analisi reale
 */
function optimizePriorityAndDifficultyWithAnalysis(topics, pageAnalysis) {
  const pageAnalysisMap = new Map();
  pageAnalysis.forEach(page => {
    const key = `${page.fileIndex}-${page.pageNumber}`;
    pageAnalysisMap.set(key, page);
  });
  
  return topics.map(topic => {
    // Analizza le pagine del topic per ottimizzare priorità e difficoltà
    const pageStats = analyzeTopicPagesStatistics(topic, pageAnalysisMap);
    
    // Ottimizza priorità basandosi su importance dell'analisi
    let priority = topic.priority || 'medium';
    if (pageStats.highImportanceRatio > 0.6) priority = 'high';
    if (pageStats.lowImportanceRatio > 0.6) priority = 'low';
    if (pageStats.hasFormulas && pageStats.hasExercises) priority = 'high';
    
    // Ottimizza difficoltà basandosi su analisi reale
    let difficulty = pageStats.averageDifficulty || topic.difficulty || 'intermediate';
    
    // Stima ore più accurata basata su analisi
    const estimatedHours = Math.max(
      topic.estimatedHours || 0,
      Math.ceil(pageStats.totalEstimatedMinutes / 60)
    );
    
    return {
      ...topic,
      priority,
      difficulty,
      estimatedHours,
      analysisEnhanced: true,
      analysisStats: pageStats
    };
  });
}

/**
 * Analizza statistiche delle pagine di un topic
 */
function analyzeTopicPagesStatistics(topic, pageAnalysisMap) {
  let totalEstimatedMinutes = 0;
  let highImportanceCount = 0;
  let lowImportanceCount = 0;
  let totalPages = 0;
  const difficulties = [];
  let hasFormulas = false;
  let hasExercises = false;
  
  topic.pages_info?.forEach(pInfo => {
    for (let pageNum = pInfo.start_page; pageNum <= pInfo.end_page; pageNum++) {
      const analysisKey = `${pInfo.pdf_index}-${pageNum}`;
      const pageAnalysis = pageAnalysisMap.get(analysisKey);
      
      if (pageAnalysis) {
        totalPages++;
        
        if (pageAnalysis.estimatedStudyTime) {
          totalEstimatedMinutes += pageAnalysis.estimatedStudyTime;
        }
        
        if (pageAnalysis.importance === 'high') highImportanceCount++;
        if (pageAnalysis.importance === 'low') lowImportanceCount++;
        
        if (pageAnalysis.difficulty) {
          difficulties.push(pageAnalysis.difficulty);
        }
        
        if (pageAnalysis.hasFormulas) hasFormulas = true;
        if (pageAnalysis.hasExercises) hasExercises = true;
      }
    }
  });
  
  return {
    totalEstimatedMinutes,
    highImportanceRatio: totalPages > 0 ? highImportanceCount / totalPages : 0,
    lowImportanceRatio: totalPages > 0 ? lowImportanceCount / totalPages : 0,
    averageDifficulty: calculateAverageDifficulty(difficulties),
    hasFormulas,
    hasExercises,
    totalPagesAnalyzed: totalPages
  };
}

/**
 * Calcola statistiche complete con analisi
 */
function calculateComprehensiveStatisticsWithAnalysis(topics, pageAnalysis) {
  const totalTopics = topics.length;
  const totalPages = topics.reduce((sum, topic) => sum + topic.totalPages, 0);
  const avgPagesPerTopic = totalTopics > 0 ? Math.round(totalPages / totalTopics) : 0;
  
  const priorityDistribution = topics.reduce((acc, topic) => {
    acc[topic.priority || 'medium'] = (acc[topic.priority || 'medium'] || 0) + 1;
    return acc;
  }, {});
  
  const difficultyDistribution = topics.reduce((acc, topic) => {
    acc[topic.difficulty || 'intermediate'] = (acc[topic.difficulty || 'intermediate'] || 0) + 1;
    return acc;
  }, {});
  
  // Statistiche basate sull'analisi pagina-per-pagina
  const analysisStats = calculateAnalysisBasedStatistics(pageAnalysis);
  
  return {
    totalTopics,
    totalPages,
    avgPagesPerTopic,
    minPages: totalTopics > 0 ? Math.min(...topics.map(t => t.totalPages)) : 0,
    maxPages: totalTopics > 0 ? Math.max(...topics.map(t => t.totalPages)) : 0,
    priorityDistribution,
    difficultyDistribution,
    estimatedTotalHours: topics.reduce((sum, topic) => sum + (topic.estimatedHours || 0), 0),
    
    // Statistiche dall'analisi pagina-per-pagina
    analysisIntegration: {
      totalPagesAnalyzed: pageAnalysis.length,
      analysisQuality: calculateAnalysisQuality(pageAnalysis),
      contentDistribution: analysisStats.contentDistribution,
      difficultyFromAnalysis: analysisStats.difficultyDistribution,
      specialElements: analysisStats.specialElements
    },
    
    qualityMetrics: {
      avgQualityScore: topics.length > 0 
        ? topics.reduce((sum, topic) => sum + (topic.validation?.qualityScore || 0.5), 0) / topics.length
        : 0,
      topicsWithExercises: topics.filter(t => t.hasExercises).length,
      topicsWithFormulas: topics.filter(t => t.hasFormulas).length,
      analysisEnhanced: topics.filter(t => t.analysisEnhanced).length,
      analysisIntegrationScore: analysisStats.integrationScore
    }
  };
}

/**
 * Calcola statistiche basate sull'analisi pagina-per-pagina
 */
function calculateAnalysisBasedStatistics(pageAnalysis) {
  const contentDistribution = { theory: 0, examples: 0, exercises: 0, mixed: 0, other: 0 };
  const difficultyDistribution = { beginner: 0, intermediate: 0, advanced: 0 };
  const specialElements = { formulas: 0, exercises: 0, images: 0, tables: 0 };
  
  pageAnalysis.forEach(page => {
    // Distribuzione contenuto
    const contentType = page.contentType || 'other';
    if (contentDistribution.hasOwnProperty(contentType)) {
      contentDistribution[contentType]++;
    } else {
      contentDistribution.other++;
    }
    
    // Distribuzione difficoltà
    const difficulty = page.difficulty || 'intermediate';
    if (difficultyDistribution.hasOwnProperty(difficulty)) {
      difficultyDistribution[difficulty]++;
    }
    
    // Elementi speciali
    if (page.hasFormulas) specialElements.formulas++;
    if (page.hasExercises) specialElements.exercises++;
    if (page.hasImages) specialElements.images++;
    if (page.hasTables) specialElements.tables++;
  });
  
  // Calcola integration score
  const totalPages = pageAnalysis.length;
  const analysisCompleteness = totalPages > 0 ? 1.0 : 0.0;
  const contentVariety = Object.values(contentDistribution).filter(v => v > 0).length / Object.keys(contentDistribution).length;
  const integrationScore = (analysisCompleteness + contentVariety) / 2;
  
  return {
    contentDistribution,
    difficultyDistribution,
    specialElements,
    integrationScore
  };
}

/**
 * Calcola qualità dell'analisi
 */
function calculateAnalysisQuality(pageAnalysis) {
  if (pageAnalysis.length === 0) return 0.0;
  
  let qualitySum = 0;
  let validPages = 0;
  
  pageAnalysis.forEach(page => {
    let pageQuality = 0.5; // Base quality
    
    // Bonus per completezza dei dati
    if (page.pageTitle && page.pageTitle.length > 0) pageQuality += 0.1;
    if (page.mainTopics && page.mainTopics.length > 0) pageQuality += 0.1;
    if (page.keyTerms && page.keyTerms.length > 0) pageQuality += 0.1;
    if (page.difficulty) pageQuality += 0.1;
    if (page.estimatedStudyTime && page.estimatedStudyTime > 0) pageQuality += 0.1;
    if (page.contentType) pageQuality += 0.1;
    
    qualitySum += Math.min(1.0, pageQuality);
    validPages++;
  });
  
  return validPages > 0 ? qualitySum / validPages : 0.0;
}

/**
 * Utility functions
 */
function calculateAverageDifficulty(difficulties) {
  if (!difficulties || difficulties.length === 0) return 'intermediate';
  
  const difficultyScores = { beginner: 1, intermediate: 2, advanced: 3 };
  const avgScore = difficulties.reduce((sum, diff) => sum + (difficultyScores[diff] || 2), 0) / difficulties.length;
  
  if (avgScore <= 1.3) return 'beginner';
  if (avgScore >= 2.7) return 'advanced';
  return 'intermediate';
}

function findMostCommon(array) {
  if (!array || array.length === 0) return null;
  
  const frequency = {};
  array.forEach(item => frequency[item] = (frequency[item] || 0) + 1);
  
  return Object.keys(frequency).reduce((a, b) => frequency[a] > frequency[b] ? a : b);
}

function calculateTopicQualityScore(topic, totalPages) {
  let score = 0.5; // Base score
  
  if (topic.description && topic.description.length > 50) score += 0.1;
  if (topic.keyConcepts && topic.keyConcepts.length > 3) score += 0.1;
  if (topic.learningObjectives && topic.learningObjectives.length > 0) score += 0.1;
  if (totalPages >= 8 && totalPages <= 25) score += 0.2; // Dimensione ottimale
  if (topic.priority === 'high') score += 0.1;
  if (topic.analysisEnhanced) score += 0.1; // Bonus per integrazione analisi
  
  return Math.min(1.0, score);
}

function calculateQualityScore(topics) {
  if (topics.length === 0) return 0;
  
  const avgQuality = topics.reduce((sum, topic) => sum + (topic.validation?.qualityScore || 0.5), 0) / topics.length;
  const balanceScore = calculateBalanceScore(topics);
  const coverageScore = topics.length >= 5 ? 1.0 : topics.length / 5;
  const analysisIntegrationScore = topics.filter(t => t.analysisEnhanced).length / topics.length;
  
  return (avgQuality + balanceScore + coverageScore + analysisIntegrationScore) / 4;
}

function calculateBalanceScore(topics) {
  const pages = topics.map(t => t.totalPages);
  if (pages.length <= 1) return 1.0;
  
  const mean = pages.reduce((sum, p) => sum + p, 0) / pages.length;
  const variance = pages.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / pages.length;
  const stdDev = Math.sqrt(variance);
  
  // Score più alto per varianza più bassa (più bilanciato)
  return Math.max(0, 1 - (stdDev / mean));
}

// ===== ORCHESTRATORE PRINCIPALE =====

/**
 * Esegue l'analisi completa dei contenuti con SINGLE-CALL ARCHITECTURE
 * INPUT: ContentAnalysisInput
 * OUTPUT: ContentAnalysisOutput
 */
export async function analyzeContent(input) {
  const { examName, files, userDescription = '', analysisMode = 'pdf', progressCallback } = input;
  
  // Validazione input
  validatePhaseInput('content-analysis', examName, files);
  
  logPhase('content-analysis', `ANALISI CONTENUTI SINGLE-CALL (${analysisMode.toUpperCase()})`);
  logPhase('content-analysis', `📚 ${examName} | 📁 ${files?.length || 0} file | 📝 ${userDescription || 'Nessuna nota'}`);
  
  try {
    // MEGA-FASE 1: Analisi Completa Single-Call (sostituisce le prime 4 fasi)
    progressCallback?.({ type: 'processing', message: `Mega-analisi pagina-per-pagina (${analysisMode})...` });
    const megaAnalysisResult = await executePhaseWithErrorHandling(
      'mega-page-analysis',
      phaseMegaPageByPageAnalysis,
      { examName, files, userDescription, analysisMode, progressCallback }
    );
    
    // FASE 2: Sintesi Intelligente Argomenti (basata su analisi completa)
    progressCallback?.({ type: 'processing', message: 'Sintesi intelligente argomenti...' });
    const synthesisResult = await executePhaseWithErrorHandling(
      'intelligent-topic-synthesis',
      phaseIntelligentTopicSynthesis,
      { examName, megaAnalysisResult, userDescription, progressCallback }
    );
    
    // FASE 3: Validazione e Ottimizzazione Finale (con contesto analisi)
    progressCallback?.({ type: 'processing', message: 'Validazione e ottimizzazione con contesto analisi...' });
    const finalResult = await executePhaseWithErrorHandling(
      'final-validation-optimization',
      phaseFinalValidationAndOptimization,
      { synthesisResult, files, megaAnalysisResult, examName, progressCallback }
    );
    
    const output = createContentPhaseOutput('content-analysis', {
      topics: finalResult.validatedTopics,
      statistics: finalResult.statistics,
      phaseResults: {
        megaAnalysis: megaAnalysisResult,
        synthesis: synthesisResult,
        validation: finalResult
      }
    }, {
      analysisMode,
      totalFiles: files.length,
      totalTopics: finalResult.validatedTopics.length,
      totalPages: finalResult.statistics.totalPages,
      qualityScore: finalResult.validationReport.qualityScore,
      singleCallArchitecture: true,
      pagesAnalyzed: megaAnalysisResult.pageByPageAnalysis?.length || 0
    });

    logPhase('content-analysis', `ANALISI SINGLE-CALL COMPLETATA: ${output.data.topics.length} argomenti, ${output.data.statistics.totalPages} pagine`);
    logPhase('content-analysis', `QUALITÀ: ${Math.round(finalResult.validationReport.qualityScore * 100)}% | PAGINE ANALIZZATE: ${megaAnalysisResult.pageByPageAnalysis?.length || 0}`);
    logPhase('content-analysis', `ARCHITETTURA: Single-call (1 mega-chiamata + 1 sintesi + 1 validazione)`);
    progressCallback?.({ type: 'processing', message: `Analisi single-call completata (${analysisMode})!` });
    
    return output;

  } catch (error) {
    logPhase('content-analysis', `ERRORE ANALISI SINGLE-CALL (${analysisMode}): ${error.message}`);
    throw createPhaseError('content-analysis', `Errore analisi contenuti single-call (${analysisMode}): ${error.message}`, error);
  }
}

// ===== FUNZIONI DI FALLBACK E RECOVERY =====

/**
 * Fallback intelligente se la mega-analisi fallisce parzialmente
 */
async function handlePartialMegaAnalysisFailure(partialResult, input) {
  logPhase('fallback-recovery', 'Gestione fallimento parziale mega-analisi...');
  
  const { examName, files, userDescription, analysisMode, progressCallback } = input;
  
  // Se abbiamo almeno una struttura globale, proviamo a recuperare
  if (partialResult.globalStructure && partialResult.globalStructure.estimatedTotalPages > 0) {
    logPhase('fallback-recovery', 'Struttura globale disponibile, tentativo recupero...');
    
    // Genera analisi pagina-per-pagina semplificata basata sulla struttura
    const fallbackPageAnalysis = generateFallbackPageAnalysis(
      partialResult.globalStructure, 
      files, 
      analysisMode
    );
    
    return {
      ...partialResult,
      pageByPageAnalysis: fallbackPageAnalysis,
      contentSummary: generateFallbackContentSummary(fallbackPageAnalysis),
      analysisMetadata: {
        analysisMode: analysisMode,
        completeness: 0.7, // Parziale
        confidence: 0.6,
        processingNotes: 'Analisi recuperata tramite fallback intelligente'
      }
    };
  }
  
  // Se non abbiamo nemmeno la struttura, generiamo analisi minimale
  logPhase('fallback-recovery', 'Generazione analisi minimale...');
  return generateMinimalAnalysis(files, examName, analysisMode);
}

/**
 * Genera analisi pagina-per-pagina di fallback
 */
function generateFallbackPageAnalysis(globalStructure, files, analysisMode) {
  const fallbackPages = [];
  const totalPages = globalStructure.estimatedTotalPages || 100;
  
  files.forEach((file, fileIndex) => {
    const pagesPerFile = Math.ceil(totalPages / files.length);
    
    for (let pageNum = 1; pageNum <= pagesPerFile; pageNum++) {
      fallbackPages.push({
        fileIndex: fileIndex,
        fileName: file.name,
        pageNumber: pageNum,
        pageTitle: `Pagina ${pageNum} - ${file.name}`,
        mainTopics: [{
          topicName: `Argomento da ${file.name} p.${pageNum}`,
          description: `Contenuto della pagina ${pageNum} del file ${file.name}`,
          importance: 'medium',
          keyPoints: [`Concetto pagina ${pageNum}`, `Punto chiave ${pageNum}`]
        }],
        contentType: 'mixed',
        difficulty: 'intermediate',
        hasFormulas: false,
        hasExercises: false,
        hasImages: false,
        hasTables: false,
        estimatedStudyTime: 20,
        conceptDensity: 'medium',
        prerequisites: [],
        keyTerms: [`termine_${pageNum}`],
        connections: [],
        studyNotes: `Studio normale della pagina ${pageNum}`
      });
    }
  });
  
  return fallbackPages;
}

/**
 * Genera content summary di fallback
 */
function generateFallbackContentSummary(pageAnalysis) {
  return {
    totalPagesAnalyzed: pageAnalysis.length,
    contentDistribution: {
      theory: Math.floor(pageAnalysis.length * 0.6),
      examples: Math.floor(pageAnalysis.length * 0.2),
      exercises: Math.floor(pageAnalysis.length * 0.1),
      mixed: Math.floor(pageAnalysis.length * 0.1)
    },
    difficultyBreakdown: {
      beginner: Math.floor(pageAnalysis.length * 0.3),
      intermediate: Math.floor(pageAnalysis.length * 0.5),
      advanced: Math.floor(pageAnalysis.length * 0.2)
    },
    specialElements: {
      formulaPages: Math.floor(pageAnalysis.length * 0.1),
      exercisePages: Math.floor(pageAnalysis.length * 0.15),
      imagePages: Math.floor(pageAnalysis.length * 0.2),
      tablePages: Math.floor(pageAnalysis.length * 0.05)
    },
    estimatedTotalStudyTime: pageAnalysis.length * 20 // 20 minuti per pagina
  };
}

/**
 * Genera analisi minimale in caso di fallimento completo
 */
function generateMinimalAnalysis(files, examName, analysisMode) {
  logPhase('minimal-analysis', 'Generazione analisi minimale per recovery...');
  
  const estimatedPagesPerFile = 50; // Stima di default
  const totalEstimatedPages = files.length * estimatedPagesPerFile;
  
  return {
    globalStructure: {
      totalFiles: files.length,
      materialType: 'mixed',
      overallOrganization: `Materiale per l'esame ${examName} - ${files.length} file`,
      estimatedTotalPages: totalEstimatedPages,
      mainSections: files.map((file, index) => ({
        sectionTitle: file.name,
        fileIndex: index,
        startPage: 1,
        endPage: estimatedPagesPerFile,
        sectionType: 'chapter',
        importance: 'medium',
        description: `Contenuto del file ${file.name}`
      })),
      structuralElements: []
    },
    pageByPageAnalysis: generateFallbackPageAnalysis(
      { estimatedTotalPages: totalEstimatedPages }, 
      files, 
      analysisMode
    ),
    contentSummary: {
      totalPagesAnalyzed: totalEstimatedPages,
      contentDistribution: { theory: 30, examples: 10, exercises: 5, mixed: 5 },
      difficultyBreakdown: { beginner: 15, intermediate: 25, advanced: 10 },
      specialElements: { formulaPages: 5, exercisePages: 7, imagePages: 10, tablePages: 2 },
      estimatedTotalStudyTime: totalEstimatedPages * 20
    },
    analysisMetadata: {
      analysisMode: analysisMode,
      completeness: 0.4,
      confidence: 0.3,
      processingNotes: 'Analisi minimale generata per recovery da fallimento completo'
    }
  };
}

// ===== VALIDATION E QUALITY ASSURANCE =====

/**
 * Valida il risultato della mega-analisi
 */
function validateMegaAnalysisResult(result) {
  const errors = [];
  
  // Verifica struttura globale
  if (!result.globalStructure) {
    errors.push('globalStructure mancante');
  } else {
    if (!result.globalStructure.totalFiles || result.globalStructure.totalFiles <= 0) {
      errors.push('totalFiles non valido in globalStructure');
    }
    if (!result.globalStructure.estimatedTotalPages || result.globalStructure.estimatedTotalPages <= 0) {
      errors.push('estimatedTotalPages non valido in globalStructure');
    }
  }
  
  // Verifica analisi pagina-per-pagina
  if (!result.pageByPageAnalysis || !Array.isArray(result.pageByPageAnalysis)) {
    errors.push('pageByPageAnalysis mancante o non è array');
  } else if (result.pageByPageAnalysis.length === 0) {
    errors.push('pageByPageAnalysis vuoto');
  } else {
    // Verifica qualità delle entries
    const validPages = result.pageByPageAnalysis.filter(page => 
      page.fileIndex !== undefined && 
      page.pageNumber !== undefined && 
      page.mainTopics && 
      Array.isArray(page.mainTopics)
    );
    
    if (validPages.length < result.pageByPageAnalysis.length * 0.8) {
      errors.push('Troppi record pageByPageAnalysis incompleti');
    }
  }
  
  // Verifica content summary
  if (!result.contentSummary) {
    errors.push('contentSummary mancante');
  }
  
  if (errors.length > 0) {
    throw new Error(`Validazione mega-analisi fallita: ${errors.join(', ')}`);
  }
  
  return true;
}

/**
 * Migliora la qualità del risultato della sintesi
 */
function enhanceSynthesisQuality(synthesisResult, megaAnalysisResult) {
  logPhase('quality-enhancement', 'Miglioramento qualità sintesi...');
  
  const enhancedTopics = synthesisResult.synthesizedTopics.map(topic => {
    // Arricchisci con statistiche dall'analisi completa
    const topicStats = calculateTopicStatisticsFromAnalysis(topic, megaAnalysisResult);
    
    return {
      ...topic,
      enhancedMetrics: topicStats,
      qualityScore: calculateEnhancedQualityScore(topic, topicStats),
      studyRecommendations: generateStudyRecommendations(topic, topicStats)
    };
  });
  
  return {
    ...synthesisResult,
    synthesizedTopics: enhancedTopics,
    qualityEnhancement: {
      applied: true,
      enhancedTopics: enhancedTopics.length,
      averageQualityScore: enhancedTopics.reduce((sum, t) => sum + t.qualityScore, 0) / enhancedTopics.length
    }
  };
}

/**
 * Calcola statistiche del topic dall'analisi completa
 */
function calculateTopicStatisticsFromAnalysis(topic, megaAnalysisResult) {
  const pageAnalysisMap = new Map();
  megaAnalysisResult.pageByPageAnalysis.forEach(page => {
    const key = `${page.fileIndex}-${page.pageNumber}`;
    pageAnalysisMap.set(key, page);
  });
  
  let totalStudyTime = 0;
  let conceptDensityScores = [];
  let importanceScores = [];
  let difficultyScores = [];
  
  topic.pages_info?.forEach(pInfo => {
    for (let pageNum = pInfo.start_page; pageNum <= pInfo.end_page; pageNum++) {
      const analysisKey = `${pInfo.pdf_index}-${pageNum}`;
      const pageAnalysis = pageAnalysisMap.get(analysisKey);
      
      if (pageAnalysis) {
        if (pageAnalysis.estimatedStudyTime) totalStudyTime += pageAnalysis.estimatedStudyTime;
        if (pageAnalysis.conceptDensity) conceptDensityScores.push(pageAnalysis.conceptDensity);
        if (pageAnalysis.importance) importanceScores.push(pageAnalysis.importance);
        if (pageAnalysis.difficulty) difficultyScores.push(pageAnalysis.difficulty);
      }
    }
  });
  
  return {
    totalStudyTimeFromAnalysis: totalStudyTime,
    averageConceptDensity: calculateAverageConceptDensity(conceptDensityScores),
    averageImportance: calculateAverageImportance(importanceScores),
    difficultyDistribution: calculateDifficultyDistribution(difficultyScores),
    analysisBasedEstimation: true
  };
}

function calculateAverageConceptDensity(densityScores) {
  if (densityScores.length === 0) return 'medium';
  
  const densityValues = { low: 1, medium: 2, high: 3 };
  const avgScore = densityScores.reduce((sum, density) => sum + (densityValues[density] || 2), 0) / densityScores.length;
  
  if (avgScore <= 1.3) return 'low';
  if (avgScore >= 2.7) return 'high';
  return 'medium';
}

function calculateAverageImportance(importanceScores) {
  if (importanceScores.length === 0) return 'medium';
  
  const importanceValues = { low: 1, medium: 2, high: 3 };
  const avgScore = importanceScores.reduce((sum, importance) => sum + (importanceValues[importance] || 2), 0) / importanceScores.length;
  
  if (avgScore <= 1.3) return 'low';
  if (avgScore >= 2.7) return 'high';
  return 'medium';
}

function calculateDifficultyDistribution(difficultyScores) {
  const distribution = { beginner: 0, intermediate: 0, advanced: 0 };
  
  difficultyScores.forEach(difficulty => {
    if (distribution.hasOwnProperty(difficulty)) {
      distribution[difficulty]++;
    }
  });
  
  return distribution;
}

/**
 * Calcola quality score migliorato
 */
function calculateEnhancedQualityScore(topic, topicStats) {
  let score = calculateTopicQualityScore(topic, topic.totalPages);
  
  // Bonus basati su statistiche dall'analisi
  if (topicStats.averageImportance === 'high') score += 0.1;
  if (topicStats.averageConceptDensity === 'high') score += 0.05;
  if (topicStats.analysisBasedEstimation) score += 0.05;
  
  return Math.min(1.0, score);
}

/**
 * Genera raccomandazioni di studio
 */
function generateStudyRecommendations(topic, topicStats) {
  const recommendations = [];
  
  if (topicStats.averageConceptDensity === 'high') {
    recommendations.push('Alta densità concettuale: studia in sessioni brevi con pause frequenti');
  }
  
  if (topicStats.averageImportance === 'high') {
    recommendations.push('Argomento ad alta importanza: dedica tempo extra e ripassa più volte');
  }
  
  if (topicStats.totalStudyTimeFromAnalysis > 120) { // > 2 ore
    recommendations.push('Argomento lungo: suddividi in sessioni multiple');
  }
  
  const difficultyDistrib = topicStats.difficultyDistribution;
  if (difficultyDistrib.advanced > difficultyDistrib.beginner + difficultyDistrib.intermediate) {
    recommendations.push('Prevalentemente avanzato: assicurati di avere solide basi prima di affrontarlo');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Approccio standard: studio costante con revisioni regolari');
  }
  
  return recommendations;
}

// ===== EXPORT DEFAULT =====
export default {
  analyzeContent,
  MODULE_CONFIG,
  
  // Funzioni di supporto esposte per testing/debugging
  phaseMegaPageByPageAnalysis,
  phaseIntelligentTopicSynthesis,
  phaseFinalValidationAndOptimization,
  
  // Funzioni di fallback
  handlePartialMegaAnalysisFailure,
  generateMinimalAnalysis,
  
  // Validation e quality assurance
  validateMegaAnalysisResult,
  enhanceSynthesisQuality
};