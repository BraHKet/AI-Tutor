// src/utils/gemini/modules/contentAnalysisModule.js - MODULO ANALISI CONTENUTI COMPLETAMENTE INDIPENDENTE

import { executeAIRequest, createAIServiceInput, validateAIServiceOutput } from '../services/geminiAIService.js';
import { 
  createContentPhaseInput, 
  createContentPhaseOutput, 
  validatePhaseInput,
  logPhase,
  createPhaseError,
  executePhaseWithErrorHandling
} from '../shared/geminiShared.js';

// ===== CONFIGURAZIONE MODULO =====
const MODULE_CONFIG = {
  MAX_TOPICS: 15,
  MIN_TOPICS: 5,
  MIN_TOPIC_PAGES: 5,
  MAX_TOPIC_PAGES: 20,
  IDEAL_TOPIC_PAGES: 12
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

// ===== FASI DI ANALISI =====

/**
 * FASE 1: Ricerca Indice
 * INPUT: examName, files, userDescription, analysisMode
 * OUTPUT: Informazioni sull'indice trovato
 */
async function phaseIndexSearch(input) {
  const { examName, files, userDescription, analysisMode, progressCallback } = input;
  
  logPhase('index-search', `Ricerca indice (${analysisMode} mode)`);
  
  const filesList = files
    .map((file, index) => `- PDF ${index}: ${file.name}`)
    .join('\n');

  const modeNote = analysisMode === 'text' 
    ? '\n\nNOTA: Analisi basata su testo estratto. Cerca sezioni come "Indice", "Sommario", "Contenuti".'
    : '\n\nNOTA: Analisi completa. Cerca indici visivi, sommari, elenchi di capitoli.';

  const prompt = `CERCA L'INDICE nei seguenti documenti PDF per l'esame "${examName}":

${filesList}

${userDescription ? `Note utente: "${userDescription}"` : ''}${modeNote}

OBIETTIVO: Identificare se esiste un indice/sommario e dove si trova.

Cerca:
1. Pagine con titoli come "Indice", "Sommario", "Contenuti", "Table of Contents"
2. Elenchi di capitoli con numeri di pagina
3. Strutture organizzative del contenuto

JSON richiesto:
{
  "indexFound": true/false,
  "indexLocation": {
    "pdf_index": 0,
    "filename": "nome.pdf",
    "startPage": 2,
    "endPage": 4,
    "indexType": "detailed"
  },
  "indexContent": [
    {
      "chapter": "Capitolo 1: Introduzione",
      "startPage": 5,
      "endPage": 20,
      "subsections": [
        {
          "title": "1.1 Concetti base",
          "startPage": 5,
          "endPage": 10
        }
      ]
    }
  ],
  "totalChapters": 5,
  "analysisMode": "${analysisMode}"
}`;

  const aiInput = createAIServiceInput(prompt, files, analysisMode, 'index-search', progressCallback);
  const result = await executeAIRequest(aiInput);
  
  validateAIServiceOutput(result, ['indexFound']);
  
  logPhase('index-search', `Indice ${result.data.indexFound ? 'trovato' : 'non trovato'}`);
  return result.data;
}

/**
 * FASE 2: Validazione Indice
 * INPUT: examName, indexResult, files, analysisMode
 * OUTPUT: Indice validato o struttura base creata
 */
async function phaseIndexValidation(input) {
  const { examName, indexResult, files, analysisMode, progressCallback } = input;
  
  logPhase('index-validation', `Validazione indice (${analysisMode} mode)`);
  
  const indexInfo = JSON.stringify(indexResult, null, 2);
  const modeNote = analysisMode === 'text' 
    ? '\n\nNOTA: Valida l\'indice basandoti sul testo estratto. Se non trovato, crea struttura base.'
    : '\n\nNOTA: Valida l\'indice con accesso completo. Se non trovato, analizza primi capitoli.';

  let prompt;

  if (indexResult.indexFound && indexResult.indexContent && indexResult.indexContent.length > 0) {
    logPhase('index-validation', `Validazione indice esistente (${indexResult.indexContent.length} capitoli)`);
    
    prompt = `VALIDA E RAFFINA L'INDICE trovato per l'esame "${examName}":

INDICE IDENTIFICATO:
${indexInfo}${modeNote}

OBIETTIVO: Verificare e migliorare l'indice trovato.

Verifica:
1. Coerenza dei numeri di pagina
2. Completezza delle sezioni
3. Logica dell'organizzazione

JSON richiesto:
{
  "indexValid": true/false,
  "validatedIndex": [
    {
      "chapter": "Nome capitolo",
      "startPage": 5,
      "endPage": 25,
      "importance": "high",
      "difficulty": "beginner",
      "subsections": [
        {
          "title": "Sottosezione",
          "startPage": 5,
          "endPage": 10,
          "contentType": "theory"
        }
      ]
    }
  ],
  "recommendations": ["Suggerimenti per lo studio"],
  "analysisMode": "${analysisMode}"
}`;
  } else {
    logPhase('index-validation', `Creazione struttura base (nessun indice)`);
    
    prompt = `CREA STRUTTURA BASE per l'esame "${examName}" (nessun indice trovato):

INFORMAZIONI DISPONIBILI:
${indexInfo}${modeNote}

OBIETTIVO: Creare una struttura logica analizzando i primi contenuti.

Analizza le prime 10-15 pagine per identificare:
1. Pattern di organizzazione
2. Titoli e sottotitoli principali
3. Sequenza logica del materiale

JSON richiesto:
{
  "indexValid": false,
  "estimatedStructure": [
    {
      "chapter": "Sezione stimata",
      "startPage": 1,
      "endPage": 30,
      "confidence": "medium",
      "basedOn": "Analisi prime pagine",
      "contentType": "theory"
    }
  ],
  "needsDetailedAnalysis": true,
  "analysisMode": "${analysisMode}"
}`;
  }

  const aiInput = createAIServiceInput(prompt, files, analysisMode, 'index-validation', progressCallback);
  const result = await executeAIRequest(aiInput);
  
  validateAIServiceOutput(result);
  
  logPhase('index-validation', `Indice ${result.data.indexValid ? 'validato' : 'struttura base creata'}`);
  return result.data;
}

/**
 * FASE 3: Analisi Pagina per Pagina
 * INPUT: examName, indexResult, validationResult, files, analysisMode
 * OUTPUT: Transizioni principali tra argomenti
 */
async function phasePageAnalysis(input) {
  const { examName, indexResult, validationResult, files, analysisMode, progressCallback } = input;
  
  logPhase('page-analysis', `Analisi pagine (${analysisMode} mode)`);
  
  const hasValidIndex = validationResult.indexValid || (indexResult.indexFound && indexResult.indexContent?.length > 0);
  const modeNote = analysisMode === 'text' 
    ? '\n\nNOTA: Analisi testuale. Focus su contenuti descrittivi.'
    : '\n\nNOTA: Analisi completa con elementi visivi.';

  const prompt = `ANALISI PAGINE per l'esame "${examName}":

${hasValidIndex ? 'INDICE TROVATO - Usalo come guida per identificare transizioni tra argomenti.' : 'NESSUN INDICE - Identifica transizioni basandoti sui contenuti.'}${modeNote}

OBIETTIVO: Identifica le transizioni principali tra argomenti.

Analizza le pagine e trova:
1. Quando inizia un nuovo argomento principale
2. Quando finisce un argomento
3. Pagine di esercizi/esempi vs teoria

MANTIENI BREVE - Max 50 transizioni principali.

JSON richiesto:
{
  "mainTransitions": [
    {
      "startPage": 1,
      "endPage": 15,
      "topicTitle": "Titolo argomento",
      "description": "Breve descrizione",
      "contentType": "theory",
      "importance": "high",
      "pdf_index": 0
    }
  ],
  "totalSections": 8,
  "analysisMode": "${analysisMode}"
}`;

  const aiInput = createAIServiceInput(prompt, files, analysisMode, 'page-analysis', progressCallback);
  const result = await executeAIRequest(aiInput);
  
  validateAIServiceOutput(result, ['mainTransitions']);
  
  logPhase('page-analysis', `Trovate ${result.data.mainTransitions?.length || 0} transizioni principali`);
  return result.data;
}

/**
 * FASE 4: Raggruppamento in Argomenti
 * INPUT: examName, pageAnalysisResult, userDescription
 * OUTPUT: Argomenti raggruppati
 */
async function phaseTopicGrouping(input) {
  const { examName, pageAnalysisResult, userDescription, progressCallback } = input;
  
  logPhase('topic-grouping', `Raggruppamento argomenti`);
  
  const transitions = pageAnalysisResult.mainTransitions || [];
  
  if (transitions.length === 0) {
    throw createPhaseError('topic-grouping', 'Nessuna transizione identificata nella fase precedente');
  }
  
  const transitionsInfo = transitions.slice(0, 20).map((t, i) => 
    `${i+1}. ${t.topicTitle} (pag.${t.startPage}-${t.endPage}) [${t.contentType}]`
  ).join('\n');

  const prompt = `RAGGRUPPA IN ARGOMENTI per l'esame "${examName}":

SEZIONI IDENTIFICATE:
${transitionsInfo}

${userDescription ? `Note: ${userDescription}` : ''}

REGOLE:
- ${MODULE_CONFIG.MIN_TOPICS}-${MODULE_CONFIG.MAX_TOPICS} argomenti totali
- ${MODULE_CONFIG.MIN_TOPIC_PAGES}-${MODULE_CONFIG.MAX_TOPIC_PAGES} pagine per argomento
- Raggruppa sezioni correlate
- Mantieni sequenza logica

JSON richiesto:
{
  "studyTopics": [
    {
      "id": "topic_001",
      "title": "Nome argomento",
      "description": "Descrizione",
      "pages_info": [
        {
          "pdf_index": 0,
          "original_filename": "file.pdf",
          "start_page": 5,
          "end_page": 20
        }
      ],
      "totalPages": 16,
      "priority": "high",
      "difficulty": "beginner",
      "estimatedHours": 3
    }
  ],
  "statistics": {
    "totalTopics": 8,
    "averagePagesPerTopic": 12
  }
}`;

  const aiInput = createAIServiceInput(prompt, [], 'text', 'topic-grouping', progressCallback);
  const result = await executeAIRequest(aiInput);
  
  validateAIServiceOutput(result, ['studyTopics']);
  
  logPhase('topic-grouping', `Creati ${result.data.studyTopics?.length || 0} argomenti`);
  return result.data;
}

/**
 * FASE 5: Validazione Finale
 * INPUT: topicGroupingResult, files
 * OUTPUT: Argomenti validati e corretti
 */
async function phaseTopicValidation(input) {
  const { topicGroupingResult, files } = input;
  
  logPhase('topic-validation', `Validazione finale`);
  
  const topics = topicGroupingResult.studyTopics || [];
  
  // Validazione e correzione automatica
  const validatedTopics = validateAndFixTopics(topics, files);
  
  const finalStats = {
    totalTopics: validatedTopics.length,
    totalAssignedPages: validatedTopics.reduce((sum, topic) => {
      return sum + (topic.pages_info?.reduce((pageSum, pInfo) => {
        return pageSum + (pInfo.end_page - pInfo.start_page + 1);
      }, 0) || 0);
    }, 0)
  };
  
  finalStats.averagePagesPerTopic = finalStats.totalTopics > 0 
    ? Math.round(finalStats.totalAssignedPages / finalStats.totalTopics) 
    : 0;

  logPhase('topic-validation', `Validazione completata: ${validatedTopics.length} argomenti, ${finalStats.totalAssignedPages} pagine totali`);
  
  return {
    validatedTopics,
    statistics: finalStats,
    originalGrouping: topicGroupingResult
  };
}

// ===== UTILITY FUNCTIONS =====

/**
 * Valida e corregge gli argomenti
 */
function validateAndFixTopics(topics, files) {
  logPhase('validation', `Validazione ${topics.length} argomenti...`);
  
  // Rimuovi topic senza pagine
  let validTopics = topics.filter(topic => {
    const hasPages = topic.pages_info && topic.pages_info.length > 0;
    if (!hasPages) {
      logPhase('validation', `Rimosso "${topic.title}" (senza pagine)`);
    }
    return hasPages;
  });

  // Correggi sovrapposizioni di pagine
  const pageAssignments = new Map();
  const overlappingPages = [];

  validTopics.forEach(topic => {
    topic.pages_info?.forEach(pInfo => {
      const pdfIndex = pInfo.pdf_index;
      if (!pageAssignments.has(pdfIndex)) {
        pageAssignments.set(pdfIndex, new Map());
      }
      
      const pageMap = pageAssignments.get(pdfIndex);
      for (let pageNum = pInfo.start_page; pageNum <= pInfo.end_page; pageNum++) {
        if (pageMap.has(pageNum)) {
          overlappingPages.push({
            pdfIndex,
            pageNum,
            topics: [pageMap.get(pageNum), topic.title]
          });
        }
        pageMap.set(pageNum, topic.title);
      }
    });
  });

  // Correggi sovrapposizioni se presenti
  if (overlappingPages.length > 0) {
    logPhase('validation', `Correggendo ${overlappingPages.length} sovrapposizioni...`);
    
    const sortedTopics = [...validTopics].sort((a, b) => {
      const pagesA = a.pages_info?.reduce((sum, p) => sum + (p.end_page - p.start_page + 1), 0) || 0;
      const pagesB = b.pages_info?.reduce((sum, p) => sum + (p.end_page - p.start_page + 1), 0) || 0;
      return pagesA - pagesB;
    });

    const correctedPageAssignments = new Map();
    
    for (const topic of sortedTopics) {
      const newPagesInfo = [];
      
      for (const pInfo of (topic.pages_info || [])) {
        const pdfIndex = pInfo.pdf_index;
        if (!correctedPageAssignments.has(pdfIndex)) {
          correctedPageAssignments.set(pdfIndex, new Map());
        }
        
        const pageMap = correctedPageAssignments.get(pdfIndex);
        let currentStartPage = null;
        let currentEndPage = null;
        
        for (let pageNum = pInfo.start_page; pageNum <= pInfo.end_page; pageNum++) {
          if (!pageMap.has(pageNum)) {
            pageMap.set(pageNum, topic.title);
            
            if (currentStartPage === null) {
              currentStartPage = pageNum;
            }
            currentEndPage = pageNum;
          } else {
            if (currentStartPage !== null && currentEndPage !== null) {
              newPagesInfo.push({
                ...pInfo,
                start_page: currentStartPage,
                end_page: currentEndPage
              });
              currentStartPage = null;
              currentEndPage = null;
            }
          }
        }
        
        if (currentStartPage !== null && currentEndPage !== null) {
          newPagesInfo.push({
            ...pInfo,
            start_page: currentStartPage,
            end_page: currentEndPage
          });
        }
      }
      
      topic.pages_info = newPagesInfo;
      topic.totalPages = newPagesInfo.reduce((sum, pInfo) => 
        sum + (pInfo.end_page - pInfo.start_page + 1), 0
      );
    }
    
    logPhase('validation', `Sovrapposizioni corrette`);
  }

  // Filtra topic che non hanno più pagine dopo la correzione
  validTopics = validTopics.filter(topic => {
    const hasValidPages = topic.pages_info && topic.pages_info.length > 0 && topic.totalPages > 0;
    if (!hasValidPages) {
      logPhase('validation', `Rimosso "${topic.title}" (nessuna pagina valida)`);
    }
    return hasValidPages;
  });

  logPhase('validation', `Validazione completata: ${validTopics.length} argomenti finali`);
  return validTopics;
}

// ===== ORCHESTRATORE PRINCIPALE =====

/**
 * Esegue l'analisi completa dei contenuti
 * INPUT: ContentAnalysisInput
 * OUTPUT: ContentAnalysisOutput
 */
export async function analyzeContent(input) {
  const { examName, files, userDescription = '', analysisMode = 'pdf', progressCallback } = input;
  
  // Validazione input
  validatePhaseInput('content-analysis', examName, files);
  
  logPhase('content-analysis', `ANALISI CONTENUTI (${analysisMode.toUpperCase()})`);
  logPhase('content-analysis', `📚 ${examName} | 📁 ${files?.length || 0} file | 📝 ${userDescription || 'Nessuna nota'}`);
  
  try {
    // FASE 1: Ricerca Indice
    progressCallback?.({ type: 'processing', message: `Fase 1/5: Ricerca indice (${analysisMode})...` });
    const indexResult = await executePhaseWithErrorHandling(
      'index-search',
      phaseIndexSearch,
      { examName, files, userDescription, analysisMode, progressCallback }
    );
    
    // FASE 2: Validazione Indice
    progressCallback?.({ type: 'processing', message: `Fase 2/5: Validazione indice (${analysisMode})...` });
    const validationResult = await executePhaseWithErrorHandling(
      'index-validation',
      phaseIndexValidation,
      { examName, indexResult, files, analysisMode, progressCallback }
    );
    
    // FASE 3: Analisi Pagina per Pagina
    progressCallback?.({ type: 'processing', message: `Fase 3/5: Analisi pagina per pagina (${analysisMode})...` });
    const pageAnalysisResult = await executePhaseWithErrorHandling(
      'page-analysis',
      phasePageAnalysis,
      { examName, indexResult, validationResult, files, analysisMode, progressCallback }
    );
    
    // FASE 4: Raggruppamento Argomenti
    progressCallback?.({ type: 'processing', message: 'Fase 4/5: Raggruppamento argomenti...' });
    const topicGroupingResult = await executePhaseWithErrorHandling(
      'topic-grouping',
      phaseTopicGrouping,
      { examName, pageAnalysisResult, userDescription, progressCallback }
    );
    
    // FASE 5: Validazione Finale
    progressCallback?.({ type: 'processing', message: 'Fase 5/5: Validazione finale...' });
    const finalResult = await executePhaseWithErrorHandling(
      'topic-validation',
      phaseTopicValidation,
      { topicGroupingResult, files }
    );
    
    const output = createContentPhaseOutput('content-analysis', {
      topics: finalResult.validatedTopics,
      statistics: finalResult.statistics,
      phaseResults: {
        indexSearch: indexResult,
        indexValidation: validationResult,
        pageAnalysis: pageAnalysisResult,
        topicGrouping: topicGroupingResult,
        validation: finalResult
      }
    }, {
      analysisMode,
      totalFiles: files.length,
      totalTopics: finalResult.validatedTopics.length,
      totalPages: finalResult.statistics.totalAssignedPages
    });

    logPhase('content-analysis', `ANALISI COMPLETATA: ${output.data.topics.length} argomenti, ${output.data.statistics.totalAssignedPages} pagine`);
    progressCallback?.({ type: 'processing', message: `Analisi completata (${analysisMode})!` });
    
    return output;

  } catch (error) {
    logPhase('content-analysis', `ERRORE ANALISI (${analysisMode}): ${error.message}`);
    throw createPhaseError('content-analysis', `Errore analisi contenuti (${analysisMode}): ${error.message}`, error);
  }
}

// ===== EXPORT DEFAULT =====
export default {
  analyzeContent,
  MODULE_CONFIG
};