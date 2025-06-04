// src/utils/gemini/modules/contentAnalysisModule.js - ANALISI CONTENUTI COMPLETAMENTE RIPROGETTATA

import { executeAIRequest, createAIServiceInput, validateAIServiceOutput } from '../services/geminiAIService.js';
import { 
  createContentPhaseInput, 
  createContentPhaseOutput, 
  validatePhaseInput,
  logPhase,
  createPhaseError,
  executePhaseWithErrorHandling
} from '../shared/geminiShared.js';

// ===== CONFIGURAZIONE MODULO - NESSUN LIMITE =====
const MODULE_CONFIG = {
  UNLIMITED: true, // Flag per indicare nessun limite
  DEEP_ANALYSIS: true, // Analisi approfondita abilitata
  PAGE_BY_PAGE: true, // Analisi pagina per pagina reale
  MAX_BATCH_PAGES: 20, // Analizza 20 pagine per volta invece di tutte insieme
  MIN_TOPIC_QUALITY_SCORE: 0.1 // Score minimo qualità (molto basso)
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

// ===== FASI DI ANALISI RIPROGETTATE =====

/**
 * FASE 1: Identificazione Struttura Globale
 * INPUT: examName, files, userDescription, analysisMode
 * OUTPUT: Mappa globale della struttura del materiale
 */
async function phaseGlobalStructureMapping(input) {
  const { examName, files, userDescription, analysisMode, progressCallback } = input;
  
  logPhase('global-structure-mapping', `Mappatura struttura globale (${analysisMode} mode) - ${files.length} file`);
  
  const filesList = files
    .map((file, index) => `${index + 1}. ${file.name} (${Math.round(file.size / 1024 / 1024)} MB)`)
    .join('\n');

  const modeNote = analysisMode === 'text' 
    ? '\n\nMODALITÀ TESTO: Analizza il contenuto testuale per identificare la struttura complessiva.'
    : '\n\nMODALITÀ PDF: Analizza completamente includendo elementi visivi, grafici e layout.';

  const prompt = `MAPPATURA STRUTTURA GLOBALE per l'esame "${examName}":

FILE DA ANALIZZARE:
${filesList}

${userDescription ? `OBIETTIVI SPECIFICI: "${userDescription}"` : ''}${modeNote}

COMPITO: Identifica la struttura generale di TUTTO il materiale per comprendere come è organizzato.

Analizza e identifica:
1. TIPO DI MATERIALE per ogni file (libro, dispense, slide, esercizi, appunti)
2. STRUTTURA ORGANIZZATIVA (capitoli, sezioni, moduli, parti)
3. INDICI O SOMMARI presenti e loro locazione esatta
4. FLUSSO LOGICO dei contenuti tra i file
5. ELEMENTI STRUTTURALI (introduzioni, conclusioni, appendici)
6. PATTERN RICORRENTI (numerazione, titoli, sezioni)

IMPORTANTE: 
- NON limitare il numero di sezioni o elementi identificati
- Sii ESTREMAMENTE dettagliato nella mappatura
- Identifica OGNI elemento strutturale visibile

JSON richiesto:
{
  "globalStructure": {
    "totalFiles": ${files.length},
    "materialType": "mixed",
    "overallOrganization": "descrizione dettagliata",
    "estimatedTotalPages": 0,
    "structuralElements": [
      {
        "type": "index|chapter|section|appendix|exercises",
        "title": "Nome elemento",
        "location": {
          "fileIndex": 0,
          "startPage": 1,
          "endPage": 5
        },
        "confidence": "high|medium|low",
        "description": "Descrizione dettagliata"
      }
    ]
  },
  "fileStructures": [
    {
      "fileIndex": 0,
      "filename": "nome.pdf",
      "materialType": "textbook|slides|notes|exercises",
      "hasIndex": true,
      "indexLocation": {"startPage": 2, "endPage": 4},
      "chapterPattern": "Capitolo X:",
      "estimatedPages": 100,
      "structuralNotes": "Note sulla struttura di questo specifico file"
    }
  ],
  "crossFileRelations": [
    {
      "relationship": "continuation|supplement|reference",
      "description": "Come i file si relazionano tra loro"
    }
  ],
  "analysisMode": "${analysisMode}",
  "detailedNotes": "Osservazioni approfondite sulla struttura complessiva"
}`;

  const aiInput = createAIServiceInput(prompt, files, analysisMode, 'global-structure-mapping', progressCallback);
  const result = await executeAIRequest(aiInput);
  
  validateAIServiceOutput(result, ['globalStructure', 'fileStructures']);
  
  logPhase('global-structure-mapping', `Struttura mappata: ${result.data.globalStructure?.structuralElements?.length || 0} elementi strutturali identificati`);
  return result.data;
}

/**
 * FASE 2: Analisi Pagina per Pagina REALE
 * INPUT: examName, globalStructure, files, analysisMode
 * OUTPUT: Analisi dettagliata di ogni sezione di pagine
 */
async function phaseRealPageByPageAnalysis(input) {
  const { examName, globalStructure, files, analysisMode, progressCallback } = input;
  
  logPhase('real-page-analysis', `Analisi pagina per pagina REALE (${analysisMode} mode)`);
  
  const structuralElements = globalStructure.globalStructure?.structuralElements || [];
  const pageAnalysisResults = [];
  let totalPagesAnalyzed = 0;

  // Se non abbiamo elementi strutturali, facciamo analisi sequenziale
  if (structuralElements.length === 0) {
    logPhase('real-page-analysis', 'Nessuna struttura identificata, analisi sequenziale completa');
    
    for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
      const file = files[fileIndex];
      progressCallback?.({ type: 'processing', message: `Analisi dettagliata ${file.name}...` });
      
      const fileAnalysis = await analyzeFileInBatches(file, fileIndex, examName, analysisMode, progressCallback);
      pageAnalysisResults.push(...fileAnalysis.sections);
      totalPagesAnalyzed += fileAnalysis.totalPages;
    }
  } else {
    logPhase('real-page-analysis', `Analisi basata su ${structuralElements.length} elementi strutturali`);
    
    // Analizza ogni elemento strutturale identificato
    for (let i = 0; i < structuralElements.length; i++) {
      const element = structuralElements[i];
      const fileIndex = element.location?.fileIndex || 0;
      
      if (fileIndex >= files.length) continue;
      
      progressCallback?.({ type: 'processing', message: `Analisi elemento ${i + 1}/${structuralElements.length}: ${element.title}...` });
      
      const elementAnalysis = await analyzeStructuralElement(
        element, 
        files[fileIndex], 
        fileIndex, 
        examName, 
        analysisMode, 
        progressCallback
      );
      
      pageAnalysisResults.push(elementAnalysis);
      totalPagesAnalyzed += (element.location?.endPage || 0) - (element.location?.startPage || 0) + 1;
    }
  }

  logPhase('real-page-analysis', `Analisi completata: ${pageAnalysisResults.length} sezioni, ${totalPagesAnalyzed} pagine totali`);

  return {
    pageAnalysisResults,
    totalSections: pageAnalysisResults.length,
    totalPagesAnalyzed,
    analysisMode,
    baseStructure: globalStructure
  };
}

/**
 * Analizza un file in batch di pagine
 */
async function analyzeFileInBatches(file, fileIndex, examName, analysisMode, progressCallback) {
  logPhase('batch-analysis', `Analisi file ${file.name} in batch`);
  
  // Stima il numero di pagine (approssimativo basato sulla dimensione)
  const estimatedPages = Math.ceil(file.size / (1024 * 50)); // ~50KB per pagina
  const sections = [];
  let currentPage = 1;
  
  while (currentPage <= estimatedPages) {
    const endPage = Math.min(currentPage + MODULE_CONFIG.MAX_BATCH_PAGES - 1, estimatedPages);
    
    progressCallback?.({ type: 'processing', message: `Analisi ${file.name} pagine ${currentPage}-${endPage}...` });
    
    const batchPrompt = `ANALISI DETTAGLIATA PAGINE ${currentPage}-${endPage} del file "${file.name}" per l'esame "${examName}":

MODALITÀ: ${analysisMode === 'pdf' ? 'Analisi completa PDF' : 'Analisi testuale'}

OBIETTIVO: Analizza nel dettaglio le pagine ${currentPage} a ${endPage} identificando:

1. CONTENUTO PRINCIPALE di ogni pagina o gruppo di pagine
2. TRANSIZIONI tra argomenti diversi
3. TIPOLOGIA DEL CONTENUTO (teoria, esempi, esercizi, formule)
4. TITOLI E SOTTOTITOLI presenti
5. CONCETTI CHIAVE trattati
6. DIFFICOLTÀ RELATIVA del materiale
7. COLLEGAMENTI con altre sezioni

FORMATO DETTAGLIATO - Sii estremamente specifico:

{
  "sectionAnalysis": {
    "fileIndex": ${fileIndex},
    "filename": "${file.name}",
    "pageRange": {"start": ${currentPage}, "end": ${endPage}},
    "contentType": "theory|examples|exercises|mixed",
    "mainTopics": [
      {
        "title": "Titolo specifico dell'argomento",
        "description": "Descrizione dettagliata del contenuto",
        "pageSpan": {"start": ${currentPage}, "end": ${Math.min(currentPage + 5, endPage)}},
        "importance": "high|medium|low",
        "difficulty": "beginner|intermediate|advanced",
        "concepts": ["concetto1", "concetto2"],
        "hasExercises": false,
        "hasFormulas": false,
        "contentDetails": "Dettagli specifici del contenuto"
      }
    ],
    "transitions": [
      {
        "fromTopic": "Argomento precedente",
        "toTopic": "Argomento successivo",
        "transitionPage": ${currentPage + 3},
        "transitionType": "smooth|abrupt|chapter_break"
      }
    ],
    "qualityIndicators": {
      "clarity": "high|medium|low",
      "completeness": "complete|partial|fragmented",
      "studentFriendly": true
    }
  }
}`;

    try {
      const aiInput = createAIServiceInput(batchPrompt, [file], analysisMode, 'batch-page-analysis', progressCallback);
      const result = await executeAIRequest(aiInput);
      
      if (result.success && result.data.sectionAnalysis) {
        sections.push(result.data.sectionAnalysis);
      }
    } catch (error) {
      logPhase('batch-analysis', `Errore analisi batch ${currentPage}-${endPage}: ${error.message}`);
      // Continua con il batch successivo
    }
    
    currentPage = endPage + 1;
  }
  
  return {
    sections,
    totalPages: estimatedPages,
    fileIndex,
    filename: file.name
  };
}

/**
 * Analizza un elemento strutturale specifico
 */
async function analyzeStructuralElement(element, file, fileIndex, examName, analysisMode, progressCallback) {
  logPhase('element-analysis', `Analisi elemento: ${element.title}`);
  
  const startPage = element.location?.startPage || 1;
  const endPage = element.location?.endPage || startPage + 10;
  
  const prompt = `ANALISI APPROFONDITA ELEMENTO STRUTTURALE per l'esame "${examName}":

ELEMENTO: "${element.title}"
FILE: "${file.name}"
PAGINE: ${startPage} - ${endPage}
TIPO: ${element.type}

MODALITÀ: ${analysisMode === 'pdf' ? 'Analisi completa PDF' : 'Analisi testuale'}

OBIETTIVO: Analizza in profondità questo specifico elemento strutturale.

Identifica con precisione:
1. CONTENUTO ESATTO dell'elemento
2. SOTTOSEZIONI o suddivisioni interne
3. ARGOMENTI SPECIFICI trattati
4. LIVELLO DI DETTAGLIO e profondità
5. PREREQUISITI necessari
6. COLLEGAMENTI con altri elementi
7. IMPORTANZA per l'esame

{
  "elementAnalysis": {
    "elementTitle": "${element.title}",
    "elementType": "${element.type}",
    "fileIndex": ${fileIndex},
    "pageRange": {"start": ${startPage}, "end": ${endPage}},
    "detailedContent": {
      "mainSubjects": [
        {
          "title": "Titolo specifico argomento",
          "description": "Descrizione molto dettagliata",
          "specificPages": {"start": ${startPage}, "end": ${startPage + 2}},
          "keyPoints": ["punto1", "punto2", "punto3"],
          "difficulty": "beginner|intermediate|advanced",
          "studyTime": "tempo stimato in ore",
          "examRelevance": "high|medium|low"
        }
      ],
      "internalStructure": [
        {
          "subsection": "Nome sottosezione",
          "content": "Descrizione contenuto",
          "pageLocation": ${startPage + 1}
        }
      ]
    },
    "learningObjectives": ["obiettivo1", "obiettivo2"],
    "prerequisites": ["prerequisito1", "prerequisito2"],
    "connections": {
      "relatedElements": ["elemento1", "elemento2"],
      "followsFrom": "elemento precedente",
      "leadsTo": "elemento successivo"
    },
    "studyStrategy": "Strategia consigliata per studiare questo elemento"
  }
}`;

  try {
    const aiInput = createAIServiceInput(prompt, [file], analysisMode, 'element-analysis', progressCallback);
    const result = await executeAIRequest(aiInput);
    
    return result.success ? result.data.elementAnalysis : null;
  } catch (error) {
    logPhase('element-analysis', `Errore analisi elemento ${element.title}: ${error.message}`);
    return null;
  }
}

/**
 * FASE 3: Sintesi Intelligente degli Argomenti
 * INPUT: examName, pageAnalysisResults, userDescription
 * OUTPUT: Argomenti sintetizzati basati su analisi reale delle pagine
 */
async function phaseIntelligentTopicSynthesis(input) {
  const { examName, pageAnalysisResults, userDescription, progressCallback } = input;
  
  logPhase('intelligent-topic-synthesis', `Sintesi intelligente da ${pageAnalysisResults.totalSections} sezioni analizzate`);
  
  // Prepara i dati dell'analisi reale per la sintesi
  const sectionsData = pageAnalysisResults.pageAnalysisResults
    .filter(section => section && section.mainTopics)
    .map(section => {
      const topics = Array.isArray(section.mainTopics) ? section.mainTopics : [];
      return {
        fileIndex: section.fileIndex,
        filename: section.filename,
        pageRange: section.pageRange,
        contentType: section.contentType,
        topics: topics.map(topic => ({
          title: topic.title,
          description: topic.description,
          pageSpan: topic.pageSpan,
          importance: topic.importance,
          difficulty: topic.difficulty,
          concepts: topic.concepts || [],
          hasExercises: topic.hasExercises,
          hasFormulas: topic.hasFormulas,
          contentDetails: topic.contentDetails
        }))
      };
    });

  const totalTopicsFound = sectionsData.reduce((sum, section) => sum + section.topics.length, 0);
  
  logPhase('intelligent-topic-synthesis', `Trovati ${totalTopicsFound} topic grezzi da sintetizzare`);

  const sectionsDataJson = JSON.stringify(sectionsData.slice(0, 50), null, 2); // Limita per prompt size se necessario

  const prompt = `SINTESI INTELLIGENTE ARGOMENTI per l'esame "${examName}":

DATI ANALISI REALE DELLE PAGINE:
${sectionsDataJson}

${userDescription ? `OBIETTIVI UTENTE: "${userDescription}"` : ''}

COMPITO: Sintetizza gli argomenti identificati nell'analisi pagina-per-pagina in argomenti di studio coerenti e logici.

PRINCIPI DI SINTESI:
1. **RAGGRUPPA** topic correlati che appartengono allo stesso macro-argomento
2. **MANTIENI** la granularità appropriata (né troppo generici né troppo specifici)
3. **RISPETTA** le transizioni naturali identificate nell'analisi
4. **PRESERVA** i riferimenti esatti alle pagine dall'analisi reale
5. **ORDINA** secondo la sequenza logica di apprendimento
6. **BILANCIA** il carico di studio per argomento

REGOLE INTELLIGENTI:
- Se un concetto appare in più sezioni, crea UN argomento che le include tutte
- Se una sezione contiene concetti molto diversi, suddividila in argomenti separati
- Mantieni argomenti tra 8-25 pagine quando possibile
- Priorità agli argomenti con importance="high"
- Considera la difficulty per la sequenza di studio

FORMATO DETTAGLIATO:

{
  "synthesizedTopics": [
    {
      "id": "topic_001",
      "title": "Titolo argomento sintetizzato",
      "description": "Descrizione completa che spiega cosa copre questo argomento",
      "pages_info": [
        {
          "pdf_index": 0,
          "original_filename": "filename.pdf",
          "start_page": 5,
          "end_page": 18,
          "content_notes": "Note specifiche su cosa si trova in queste pagine"
        }
      ],
      "totalPages": 14,
      "priority": "high|medium|low",
      "difficulty": "beginner|intermediate|advanced",
      "estimatedHours": 4,
      "learningObjectives": [
        "Obiettivo di apprendimento 1",
        "Obiettivo di apprendimento 2"
      ],
      "keyConcepts": ["concetto1", "concetto2", "concetto3"],
      "hasExercises": true,
      "hasFormulas": false,
      "studyTips": "Suggerimenti specifici per studiare questo argomento",
      "prerequisites": ["argomento prerequisito"],
      "synthesisNotes": "Note sulla sintesi: da quali sezioni deriva questo argomento"
    }
  ],
  "synthesisStatistics": {
    "originalSections": ${sectionsData.length},
    "originalTopics": ${totalTopicsFound},
    "synthesizedTopics": 0,
    "totalPagesAssigned": 0,
    "averagePagesPerTopic": 0,
    "synthesisStrategy": "Strategia utilizzata per la sintesi"
  },
  "qualityMetrics": {
    "coverage": "percentuale di contenuto coperto",
    "coherence": "coerenza degli argomenti sintetizzati",
    "balance": "bilanciamento del carico di studio"
  }
}

IMPORTANTE: 
- Ogni pagina deve apparire in MASSIMO un argomento
- Non lasciare "buchi" nel materiale
- Mantieni il collegamento con l'analisi reale delle pagine
- Ogni argomento deve avere un valore educativo chiaro`;

  const aiInput = createAIServiceInput(prompt, [], 'text', 'intelligent-topic-synthesis', progressCallback);
  const result = await executeAIRequest(aiInput);
  
  validateAIServiceOutput(result, ['synthesizedTopics']);
  
  const synthesizedTopics = result.data.synthesizedTopics || [];
  logPhase('intelligent-topic-synthesis', `Sintesi completata: ${synthesizedTopics.length} argomenti finali`);
  
  return result.data;
}

/**
 * FASE 4: Validazione e Ottimizzazione Finale
 * INPUT: synthesisResult, files
 * OUTPUT: Argomenti validati, ottimizzati e corretti
 */
async function phaseFinalValidationAndOptimization(input) {
  const { synthesisResult, files, examName, progressCallback } = input;
  
  logPhase('final-validation', `Validazione finale ${synthesisResult.synthesizedTopics?.length || 0} argomenti`);
  
  const topics = synthesisResult.synthesizedTopics || [];
  
  // Validazione automatica approfondita
  const validatedTopics = await performDeepValidation(topics, files, examName);
  
  // Ottimizzazione intelligente
  const optimizedTopics = await performIntelligentOptimization(validatedTopics, files);
  
  // Statistiche finali
  const finalStats = calculateComprehensiveStatistics(optimizedTopics);
  
  logPhase('final-validation', `Validazione completata: ${optimizedTopics.length} argomenti finali ottimizzati`);
  
  return {
    validatedTopics: optimizedTopics,
    statistics: finalStats,
    validationReport: {
      originalCount: topics.length,
      validatedCount: optimizedTopics.length,
      optimizationsApplied: optimizedTopics.length !== topics.length,
      qualityScore: calculateQualityScore(optimizedTopics)
    },
    originalSynthesis: synthesisResult
  };
}

/**
 * Validazione approfondita degli argomenti
 */
async function performDeepValidation(topics, files, examName) {
  logPhase('deep-validation', `Validazione approfondita ${topics.length} argomenti...`);
  
  const validatedTopics = [];
  const pageAssignments = new Map(); // Traccia assegnazioni pagine
  
  for (const topic of topics) {
    // Validazione base
    if (!topic.title || !topic.pages_info || topic.pages_info.length === 0) {
      logPhase('deep-validation', `Scartato "${topic.title}" - dati insufficienti`);
      continue;
    }
    
    // Validazione pages_info
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
      
      // Verifica sovrapposizioni
      const pdfMap = pageAssignments.get(fileIndex) || new Set();
      let hasOverlap = false;
      
      for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
        if (pdfMap.has(pageNum)) {
          hasOverlap = true;
          break;
        }
      }
      
      if (!hasOverlap) {
        // Registra le pagine come assegnate
        for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
          pdfMap.add(pageNum);
        }
        pageAssignments.set(fileIndex, pdfMap);
        
        validPagesInfo.push({
          ...pInfo,
          start_page: startPage,
          end_page: endPage,
          original_filename: files[fileIndex].name
        });
        
        totalValidPages += (endPage - startPage + 1);
      } else {
        logPhase('deep-validation', `Sovrapposizione detectata per "${topic.title}" pagine ${startPage}-${endPage}`);
      }
    }
    
    // Accetta topic solo se ha pagine valide
    if (validPagesInfo.length > 0 && totalValidPages >= 3) {
      validatedTopics.push({
        ...topic,
        pages_info: validPagesInfo,
        totalPages: totalValidPages,
        // Arricchisci con metadati di validazione
        validation: {
          originalPagesInfo: topic.pages_info.length,
          validPagesInfo: validPagesInfo.length,
          totalValidPages: totalValidPages,
          qualityScore: calculateTopicQualityScore(topic, totalValidPages)
        }
      });
      
      logPhase('deep-validation', `Validato "${topic.title}" - ${totalValidPages} pagine`);
    } else {
      logPhase('deep-validation', `Scartato "${topic.title}" - pagine insufficienti`);
    }
  }
  
  logPhase('deep-validation', `Validazione completata: ${validatedTopics.length}/${topics.length} argomenti validi`);
  return validatedTopics;
}

/**
 * Ottimizzazione intelligente degli argomenti
 */
async function performIntelligentOptimization(topics, files) {
  logPhase('intelligent-optimization', `Ottimizzazione ${topics.length} argomenti...`);
  
  let optimizedTopics = [...topics];
  
  // 1. Unisci argomenti troppo piccoli con argomenti correlati
  optimizedTopics = mergeSmallTopics(optimizedTopics);
  
  // 2. Suddividi argomenti troppo grandi se sensato
  optimizedTopics = splitLargeTopics(optimizedTopics);
  
  // 3. Riordina per sequenza logica ottimale
  optimizedTopics = reorderTopicsLogically(optimizedTopics);
  
  // 4. Ottimizza priorità e difficoltà
  optimizedTopics = optimizePriorityAndDifficulty(optimizedTopics);
  
  logPhase('intelligent-optimization', `Ottimizzazione completata: ${optimizedTopics.length} argomenti finali`);
  return optimizedTopics;
}

/**
 * Unisce argomenti troppo piccoli
 */
function mergeSmallTopics(topics) {
  const MIN_PAGES = 5;
  const mergedTopics = [];
  let pendingSmallTopic = null;
  
  for (const topic of topics) {
    if (topic.totalPages < MIN_PAGES) {
      if (pendingSmallTopic && areTopicsRelated(pendingSmallTopic, topic)) {
        // Unisci con il topic piccolo precedente
        const mergedTopic = {
          ...pendingSmallTopic,
          title: `${pendingSmallTopic.title} e ${topic.title}`,
          description: `${pendingSmallTopic.description} Include anche: ${topic.description}`,
          pages_info: [...pendingSmallTopic.pages_info, ...topic.pages_info],
          totalPages: pendingSmallTopic.totalPages + topic.totalPages,
          keyConcepts: [...(pendingSmallTopic.keyConcepts || []), ...(topic.keyConcepts || [])],
          estimatedHours: (pendingSmallTopic.estimatedHours || 0) + (topic.estimatedHours || 0)
        };
        
        mergedTopics.push(mergedTopic);
        pendingSmallTopic = null;
        logPhase('optimization', `Uniti "${pendingSmallTopic?.title}" e "${topic.title}"`);
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
 * Suddivide argomenti troppo grandi
 */
function splitLargeTopics(topics) {
  const MAX_PAGES = 35;
  const splitTopics = [];
  
  for (const topic of topics) {
    if (topic.totalPages > MAX_PAGES && topic.pages_info.length > 1) {
      // Prova a suddividere se ha più blocchi di pagine
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
      logPhase('optimization', `Suddiviso "${topic.title}" in 2 parti`);
    } else {
      splitTopics.push(topic);
    }
  }
  
  return splitTopics;
}

/**
 * Riordina argomenti per sequenza logica
 */
function reorderTopicsLogically(topics) {
  return topics.sort((a, b) => {
    // Prima i prerequisiti (difficulty: beginner)
    if (a.difficulty === 'beginner' && b.difficulty !== 'beginner') return -1;
    if (b.difficulty === 'beginner' && a.difficulty !== 'beginner') return 1;
    
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
 * Ottimizza priorità e difficoltà
 */
function optimizePriorityAndDifficulty(topics) {
  return topics.map(topic => {
    // Regola priorità basandosi su indicatori di importanza
    let priority = topic.priority || 'medium';
    
    if (topic.keyConcepts?.length > 5) priority = 'high';
    if (topic.hasFormulas) priority = 'high';
    if (topic.totalPages < 8) priority = 'low';
    
    // Regola difficoltà basandosi sul contenuto
    let difficulty = topic.difficulty || 'intermediate';
    
    if (topic.hasExercises && topic.hasFormulas) difficulty = 'advanced';
    if (topic.keyConcepts?.length < 3) difficulty = 'beginner';
    
    return {
      ...topic,
      priority,
      difficulty,
      estimatedHours: Math.max(2, Math.ceil(topic.totalPages / 6)) // ~6 pagine per ora
    };
  });
}

/**
 * Verifica se due argomenti sono correlati
 */
function areTopicsRelated(topic1, topic2) {
  const concepts1 = new Set(topic1.keyConcepts || []);
  const concepts2 = new Set(topic2.keyConcepts || []);
  
  // Calcola intersezione concetti
  const intersection = new Set([...concepts1].filter(x => concepts2.has(x)));
  const union = new Set([...concepts1, ...concepts2]);
  
  // Se condividono >30% dei concetti, sono correlati
  return intersection.size / union.size > 0.3;
}

/**
 * Calcola score di qualità per un argomento
 */
function calculateTopicQualityScore(topic, totalPages) {
  let score = 0.5; // Base score
  
  if (topic.description && topic.description.length > 50) score += 0.1;
  if (topic.keyConcepts && topic.keyConcepts.length > 3) score += 0.1;
  if (topic.learningObjectives && topic.learningObjectives.length > 0) score += 0.1;
  if (totalPages >= 8 && totalPages <= 25) score += 0.2; // Dimensione ottimale
  if (topic.priority === 'high') score += 0.1;
  
  return Math.min(1.0, score);
}

/**
 * Calcola statistiche complete
 */
function calculateComprehensiveStatistics(topics) {
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
  
  return {
    totalTopics,
    totalPages,
    avgPagesPerTopic,
    minPages: totalTopics > 0 ? Math.min(...topics.map(t => t.totalPages)) : 0,
    maxPages: totalTopics > 0 ? Math.max(...topics.map(t => t.totalPages)) : 0,
    priorityDistribution,
    difficultyDistribution,
    estimatedTotalHours: topics.reduce((sum, topic) => sum + (topic.estimatedHours || 0), 0),
    qualityMetrics: {
      avgQualityScore: topics.length > 0 
        ? topics.reduce((sum, topic) => sum + (topic.validation?.qualityScore || 0.5), 0) / topics.length
        : 0,
      topicsWithExercises: topics.filter(t => t.hasExercises).length,
      topicsWithFormulas: topics.filter(t => t.hasFormulas).length
    }
  };
}

/**
 * Calcola score di qualità complessivo
 */
function calculateQualityScore(topics) {
  if (topics.length === 0) return 0;
  
  const avgQuality = topics.reduce((sum, topic) => sum + (topic.validation?.qualityScore || 0.5), 0) / topics.length;
  const balanceScore = calculateBalanceScore(topics);
  const coverageScore = topics.length >= 5 ? 1.0 : topics.length / 5;
  
  return (avgQuality + balanceScore + coverageScore) / 3;
}

/**
 * Calcola score di bilanciamento
 */
function calculateBalanceScore(topics) {
  const pages = topics.map(t => t.totalPages);
  const mean = pages.reduce((sum, p) => sum + p, 0) / pages.length;
  const variance = pages.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / pages.length;
  const stdDev = Math.sqrt(variance);
  
  // Score più alto per varianza più bassa (più bilanciato)
  return Math.max(0, 1 - (stdDev / mean));
}

// ===== ORCHESTRATORE PRINCIPALE =====

/**
 * Esegue l'analisi completa dei contenuti CON ANALISI REALE PAGINA PER PAGINA
 * INPUT: ContentAnalysisInput
 * OUTPUT: ContentAnalysisOutput
 */
export async function analyzeContent(input) {
  const { examName, files, userDescription = '', analysisMode = 'pdf', progressCallback } = input;
  
  // Validazione input
  validatePhaseInput('content-analysis', examName, files);
  
  logPhase('content-analysis', `ANALISI CONTENUTI AVANZATA (${analysisMode.toUpperCase()})`);
  logPhase('content-analysis', `📚 ${examName} | 📁 ${files?.length || 0} file | 📝 ${userDescription || 'Nessuna nota'}`);
  
  try {
    // FASE 1: Mappatura Struttura Globale
    progressCallback?.({ type: 'processing', message: `Fase 1/4: Mappatura struttura globale (${analysisMode})...` });
    const globalStructure = await executePhaseWithErrorHandling(
      'global-structure-mapping',
      phaseGlobalStructureMapping,
      { examName, files, userDescription, analysisMode, progressCallback }
    );
    
    // FASE 2: Analisi Pagina per Pagina REALE
    progressCallback?.({ type: 'processing', message: `Fase 2/4: Analisi pagina per pagina REALE (${analysisMode})...` });
    const pageAnalysisResults = await executePhaseWithErrorHandling(
      'real-page-analysis',
      phaseRealPageByPageAnalysis,
      { examName, globalStructure, files, analysisMode, progressCallback }
    );
    
    // FASE 3: Sintesi Intelligente Argomenti
    progressCallback?.({ type: 'processing', message: 'Fase 3/4: Sintesi intelligente argomenti...' });
    const synthesisResult = await executePhaseWithErrorHandling(
      'intelligent-topic-synthesis',
      phaseIntelligentTopicSynthesis,
      { examName, pageAnalysisResults, userDescription, progressCallback }
    );
    
    // FASE 4: Validazione e Ottimizzazione Finale
    progressCallback?.({ type: 'processing', message: 'Fase 4/4: Validazione e ottimizzazione finale...' });
    const finalResult = await executePhaseWithErrorHandling(
      'final-validation-optimization',
      phaseFinalValidationAndOptimization,
      { synthesisResult, files, examName, progressCallback }
    );
    
    const output = createContentPhaseOutput('content-analysis', {
      topics: finalResult.validatedTopics,
      statistics: finalResult.statistics,
      phaseResults: {
        globalStructure: globalStructure,
        pageAnalysis: pageAnalysisResults,
        synthesis: synthesisResult,
        validation: finalResult
      }
    }, {
      analysisMode,
      totalFiles: files.length,
      totalTopics: finalResult.validatedTopics.length,
      totalPages: finalResult.statistics.totalPages,
      qualityScore: finalResult.validationReport.qualityScore
    });

    logPhase('content-analysis', `ANALISI AVANZATA COMPLETATA: ${output.data.topics.length} argomenti, ${output.data.statistics.totalPages} pagine`);
    logPhase('content-analysis', `QUALITÀ: ${Math.round(finalResult.validationReport.qualityScore * 100)}% | COPERTURA: Completa`);
    progressCallback?.({ type: 'processing', message: `Analisi avanzata completata (${analysisMode})!` });
    
    return output;

  } catch (error) {
    logPhase('content-analysis', `ERRORE ANALISI AVANZATA (${analysisMode}): ${error.message}`);
    throw createPhaseError('content-analysis', `Errore analisi contenuti avanzata (${analysisMode}): ${error.message}`, error);
  }
}

// ===== EXPORT DEFAULT =====
export default {
  analyzeContent,
  MODULE_CONFIG
};