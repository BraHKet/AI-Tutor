// src/utils/gemini/contentAnalysisPhases.js - VERSIONE COMPLETAMENTE INDIPENDENTE
import { executeAIPhase, CONFIG } from './geminiCore.js';

// ===== CONFIGURAZIONE LOCALE INDIPENDENTE =====
const CONTENT_CONFIG = {
  MAX_TOPICS: CONFIG?.CONTENT_ANALYSIS?.maxTopicsTotal || 15,
  MIN_TOPICS: CONFIG?.CONTENT_ANALYSIS?.minTopicsTotal || 5,
  MIN_TOPIC_PAGES: CONFIG?.CONTENT_ANALYSIS?.minTopicPages || 5,
  MAX_TOPIC_PAGES: CONFIG?.CONTENT_ANALYSIS?.maxTopicPages || 20,
  IDEAL_TOPIC_PAGES: CONFIG?.CONTENT_ANALYSIS?.idealTopicPages || 12
};

// ===== LOGGING UTILITY ===== 
function logPhaseResult(phaseName, result, analysisMode) {
  console.log(`\n🔍 ===== RISULTATO FASE: ${phaseName.toUpperCase()} (${analysisMode}) =====`);
  
  if (result) {
    // Log specifico per tipo di fase
    switch (phaseName) {
      case 'index_search':
        console.log(`📖 Indice trovato: ${result.indexFound ? '✅ SÌ' : '❌ NO'}`);
        if (result.indexFound && result.indexLocation) {
          console.log(`📄 Posizione: ${result.indexLocation.filename}, pagine ${result.indexLocation.startPage}-${result.indexLocation.endPage}`);
          console.log(`📋 Tipo indice: ${result.indexLocation.indexType}`);
        }
        if (result.indexContent && result.indexContent.length > 0) {
          console.log(`📚 Capitoli trovati: ${result.indexContent.length}`);
          result.indexContent.slice(0, 3).forEach((ch, i) => {
            console.log(`  ${i + 1}. ${ch.chapter} (pag. ${ch.startPage}-${ch.endPage})`);
          });
          if (result.indexContent.length > 3) {
            console.log(`  ... e altri ${result.indexContent.length - 3} capitoli`);
          }
        }
        break;
        
      case 'index_validation':
        console.log(`✅ Indice valido: ${result.indexValid ? '✅ SÌ' : '❌ NO'}`);
        if (result.validatedIndex && result.validatedIndex.length > 0) {
          console.log(`📋 Struttura validata: ${result.validatedIndex.length} sezioni`);
          result.validatedIndex.slice(0, 3).forEach((section, i) => {
            console.log(`  ${i + 1}. ${section.chapter} (${section.importance} priority, ${section.difficulty} level)`);
          });
        }
        if (result.estimatedStructure && result.estimatedStructure.length > 0) {
          console.log(`🔮 Struttura stimata: ${result.estimatedStructure.length} sezioni`);
          result.estimatedStructure.slice(0, 3).forEach((section, i) => {
            console.log(`  ${i + 1}. ${section.chapter} (confidence: ${section.confidence})`);
          });
        }
        break;
        
      case 'page_analysis':
        console.log(`🔍 Transizioni trovate: ${result.mainTransitions?.length || 0}`);
        console.log(`📊 Sezioni totali: ${result.totalSections || 'N/A'}`);
        if (result.mainTransitions && result.mainTransitions.length > 0) {
          result.mainTransitions.slice(0, 5).forEach((trans, i) => {
            console.log(`  ${i + 1}. ${trans.topicTitle} (pag. ${trans.startPage}-${trans.endPage}, ${trans.contentType})`);
          });
          if (result.mainTransitions.length > 5) {
            console.log(`  ... e altre ${result.mainTransitions.length - 5} transizioni`);
          }
        }
        break;
        
      case 'topic_grouping':
        console.log(`🎯 Argomenti creati: ${result.studyTopics?.length || 0}`);
        if (result.statistics) {
          console.log(`📊 Statistiche: ${result.statistics.totalTopics} argomenti, media ${result.statistics.averagePagesPerTopic} pag/argomento`);
        }
        if (result.studyTopics && result.studyTopics.length > 0) {
          result.studyTopics.slice(0, 5).forEach((topic, i) => {
            console.log(`  ${i + 1}. "${topic.title}" (${topic.totalPages || 'N/A'} pag, ${topic.priority || 'N/A'} priority)`);
          });
          if (result.studyTopics.length > 5) {
            console.log(`  ... e altri ${result.studyTopics.length - 5} argomenti`);
          }
        }
        break;
        
      case 'topic_validation':
        console.log(`✅ Argomenti validati: ${result.validatedTopics?.length || 0}`);
        if (result.statistics) {
          console.log(`📊 Statistiche finali: ${result.statistics.totalTopics} argomenti, ${result.statistics.totalAssignedPages} pagine totali`);
          console.log(`📈 Media pagine/argomento: ${result.statistics.averagePagesPerTopic}`);
        }
        break;
        
      default:
        console.log(`📋 Chiavi risposta:`, Object.keys(result));
    }
  } else {
    console.log(`❌ Risultato vuoto o non valido`);
  }
  
  console.log(`🔚 ===== FINE FASE: ${phaseName.toUpperCase()} =====\n`);
}

// ===== FASE 1: Ricerca Indice =====
export async function phaseIndexSearch(examName, filesArray, originalFilesDriveInfo, userDescription, progressCallback, analysisMode = 'pdf') {
  console.log(`\n🚀 INIZIO FASE 1: INDEX SEARCH (${analysisMode} mode)`);
  console.log(`📚 Esame: ${examName}`);
  console.log(`📁 File da analizzare: ${filesArray?.length || 0}`);
  
  const filesList = originalFilesDriveInfo
    .map((fInfo, index) => `- PDF ${index}: ${fInfo.name}`)
    .join('\n');

  const modeNote = analysisMode === 'text' 
    ? '\n\nNOTA: Analisi basata su testo estratto. Cerca sezioni come "Indice", "Sommario", "Contenuti".'
    : '\n\nNOTA: Analisi completa. Cerca indici visivi, sommari, elenchi di capitoli.';

  const promptText = `CERCA L'INDICE nei seguenti documenti PDF per l'esame "${examName}":

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
    "indexType": "detailed" // "detailed", "simple", "none"
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

  console.log(`💭 Prompt preparato (${promptText.length} caratteri)`);
  
  const result = await executeAIPhase('index_search', promptText, filesArray, originalFilesDriveInfo, progressCallback, analysisMode);
  
  logPhaseResult('index_search', result, analysisMode);
  return result;
}

// ===== FASE 2: Validazione e Raffinamento Indice =====
export async function phaseIndexValidation(examName, indexResult, filesArray, originalFilesDriveInfo, progressCallback, analysisMode = 'pdf') {
  console.log(`\n🚀 INIZIO FASE 2: INDEX VALIDATION (${analysisMode} mode)`);
  console.log(`📊 Input precedente: Indice ${indexResult?.indexFound ? 'trovato' : 'non trovato'}`);
  
  const indexInfo = JSON.stringify(indexResult, null, 2);

  const modeNote = analysisMode === 'text' 
    ? '\n\nNOTA: Valida l\'indice basandoti sul testo estratto. Se non trovato, crea struttura base.'
    : '\n\nNOTA: Valida l\'indice con accesso completo. Se non trovato, analizza primi capitoli.';

  let promptText;

  if (indexResult.indexFound && indexResult.indexContent && indexResult.indexContent.length > 0) {
    console.log(`✅ Modalità: Validazione indice esistente (${indexResult.indexContent.length} capitoli)`);
    // Se l'indice è stato trovato, validalo e raffinalo
    promptText = `VALIDA E RAFFINA L'INDICE trovato per l'esame "${examName}":

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
      "importance": "high", // "high", "medium", "low"
      "difficulty": "beginner", // "beginner", "intermediate", "advanced"
      "subsections": [
        {
          "title": "Sottosezione",
          "startPage": 5,
          "endPage": 10,
          "contentType": "theory" // "theory", "exercises", "examples"
        }
      ]
    }
  ],
  "recommendations": ["Suggerimenti per lo studio"],
  "analysisMode": "${analysisMode}"
}`;
  } else {
    console.log(`⚠️ Modalità: Creazione struttura base (indice non trovato)`);
    // Se l'indice non è stato trovato, crea una struttura base
    promptText = `CREA STRUTTURA BASE per l'esame "${examName}" (nessun indice trovato):

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
      "confidence": "medium", // "high", "medium", "low"
      "basedOn": "Analisi prime pagine",
      "contentType": "theory"
    }
  ],
  "needsDetailedAnalysis": true,
  "analysisMode": "${analysisMode}"
}`;
  }

  console.log(`💭 Prompt preparato (${promptText.length} caratteri)`);
  
  const result = await executeAIPhase('index_validation', promptText, filesArray, originalFilesDriveInfo, progressCallback, analysisMode);
  
  logPhaseResult('index_validation', result, analysisMode);
  return result;
}

// ===== FASE 3: Analisi Pagina per Pagina =====
export async function phasePageByPageAnalysis(examName, indexResult, validationResult, filesArray, originalFilesDriveInfo, progressCallback, analysisMode = 'pdf') {
  console.log(`\n🚀 INIZIO FASE 3: PAGE ANALYSIS (${analysisMode} mode)`);
  
  const hasValidIndex = validationResult.indexValid || (indexResult.indexFound && indexResult.indexContent?.length > 0);
  console.log(`📋 Indice disponibile: ${hasValidIndex ? '✅ SÌ' : '❌ NO'}`);

  const modeNote = analysisMode === 'text' 
    ? '\n\nNOTA: Analisi testuale. Focus su contenuti descrittivi.'
    : '\n\nNOTA: Analisi completa con elementi visivi.';

  // Prompt più conciso per evitare overflow di token
  const promptText = `ANALISI PAGINE per l'esame "${examName}":

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

  console.log(`💭 Prompt preparato (${promptText.length} caratteri)`);
  
  const result = await executeAIPhase('page_analysis', promptText, filesArray, originalFilesDriveInfo, progressCallback, analysisMode);
  
  logPhaseResult('page_analysis', result, analysisMode);
  return result;
}

// ===== FASE 4: Raggruppamento in Argomenti =====
export async function phaseTopicGrouping(examName, pageAnalysisResult, validationResult, userDescription, progressCallback, analysisMode = 'pdf') {
  console.log(`\n🚀 INIZIO FASE 4: TOPIC GROUPING (text mode)`);
  
  const transitions = pageAnalysisResult.mainTransitions || [];
  console.log(`🔗 Transizioni input: ${transitions.length}`);
  
  if (transitions.length === 0) {
    console.error(`❌ ERRORE: Nessuna transizione dalla fase precedente`);
    throw new Error('Nessuna transizione identificata nella fase precedente');
  }
  
  // Crea una descrizione concisa delle transizioni per evitare overflow
  const transitionsInfo = transitions.slice(0, 20).map((t, i) => 
    `${i+1}. ${t.topicTitle} (pag.${t.startPage}-${t.endPage}) [${t.contentType}]`
  ).join('\n');

  console.log(`📋 Usando ${Math.min(20, transitions.length)} transizioni principali`);

  const promptText = `RAGGRUPPA IN ARGOMENTI per l'esame "${examName}":

SEZIONI IDENTIFICATE:
${transitionsInfo}

${userDescription ? `Note: ${userDescription}` : ''}

REGOLE:
- ${CONTENT_CONFIG.MIN_TOPICS}-${CONTENT_CONFIG.MAX_TOPICS} argomenti totali
- ${CONTENT_CONFIG.MIN_TOPIC_PAGES}-${CONTENT_CONFIG.MAX_TOPIC_PAGES} pagine per argomento
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

  console.log(`💭 Prompt preparato (${promptText.length} caratteri)`);
  
  const result = await executeAIPhase('topic_grouping', promptText, [], [], progressCallback, 'text');
  
  logPhaseResult('topic_grouping', result, analysisMode);
  return result;
}

// ===== FASE 5: Validazione Finale =====
export async function phaseTopicValidation(topicGroupingResult, originalFilesDriveInfo, progressCallback, analysisMode = 'pdf') {
  console.log(`\n🚀 INIZIO FASE 5: TOPIC VALIDATION (${analysisMode} mode)`);
  
  const topics = topicGroupingResult.studyTopics || [];
  console.log(`📝 Argomenti da validare: ${topics.length}`);
  
  // Validazione e correzione automatica
  const validatedTopics = validateAndFixTopics(topics, originalFilesDriveInfo);
  
  console.log(`✅ Argomenti dopo validazione: ${validatedTopics.length}`);
  
  const finalStats = {
    totalTopics: validatedTopics.length,
    totalAssignedPages: validatedTopics.reduce((sum, topic) => {
      return sum + (topic.pages_info?.reduce((pageSum, pInfo) => {
        return pageSum + (pInfo.end_page - pInfo.start_page + 1);
      }, 0) || 0);
    }, 0),
    analysisMode: analysisMode
  };
  
  finalStats.averagePagesPerTopic = finalStats.totalTopics > 0 
    ? Math.round(finalStats.totalAssignedPages / finalStats.totalTopics) 
    : 0;

  console.log(`📊 Statistiche finali:`, finalStats);
  
  const result = {
    validatedTopics,
    statistics: finalStats,
    originalGrouping: topicGroupingResult
  };
  
  logPhaseResult('topic_validation', result, analysisMode);
  return result;
}

// ===== FUNZIONI DI SUPPORTO =====
function validateAndFixTopics(topics, originalFilesDriveInfo) {
  console.log(`\n🔧 VALIDAZIONE ARGOMENTI: Inizio controlli`);
  
  // Rimuovi topic senza pagine
  let validTopics = topics.filter(topic => {
    const hasPages = topic.pages_info && topic.pages_info.length > 0;
    if (!hasPages) {
      console.log(`⚠️ Rimosso argomento senza pagine: "${topic.title}"`);
    }
    return hasPages;
  });

  console.log(`📋 Argomenti con pagine valide: ${validTopics.length}/${topics.length}`);

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
    console.log(`⚠️ Trovate ${overlappingPages.length} pagine sovrapposte, correzione in corso...`);
    
    // Ordina topic per priorità (quelli con meno pagine hanno precedenza)
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
      // Ricalcola totalPages
      topic.totalPages = newPagesInfo.reduce((sum, pInfo) => 
        sum + (pInfo.end_page - pInfo.start_page + 1), 0
      );
      
      console.log(`🔧 Corretto argomento "${topic.title}": ${topic.totalPages} pagine`);
    }
    
    console.log(`✅ Sovrapposizioni corrette`);
  } else {
    console.log(`✅ Nessuna sovrapposizione trovata`);
  }

  // Filtra topic che non hanno più pagine dopo la correzione
  validTopics = validTopics.filter(topic => {
    const hasValidPages = topic.pages_info && topic.pages_info.length > 0 && topic.totalPages > 0;
    if (!hasValidPages) {
      console.log(`⚠️ Rimosso argomento senza pagine valide dopo correzione: "${topic.title}"`);
    }
    return hasValidPages;
  });

  console.log(`✅ Validazione completata: ${validTopics.length} argomenti finali validi`);
  
  // Log finale degli argomenti
  validTopics.forEach((topic, i) => {
    console.log(`  ${i + 1}. "${topic.title}" - ${topic.totalPages} pagine (${topic.priority || 'N/A'} priority)`);
  });
  
  return validTopics;
}

// ===== ORCHESTRATORE PRINCIPALE =====
export async function analyzeContentStructureMultiPhase(examName, filesArray, originalFilesDriveInfo, userDescription = "", progressCallback, analysisMode = 'pdf') {
  console.log(`\n🎯 ===== AVVIO ANALISI CONTENUTI MULTI-FASE =====`);
  console.log(`📚 Esame: "${examName}"`);
  console.log(`🔧 Modalità: ${analysisMode.toUpperCase()}`);
  console.log(`📁 File: ${filesArray?.length || 0}`);
  console.log(`📝 Descrizione utente: ${userDescription || 'Nessuna'}`);
  console.log(`⚙️ Config: ${CONTENT_CONFIG.MIN_TOPICS}-${CONTENT_CONFIG.MAX_TOPICS} argomenti, ${CONTENT_CONFIG.MIN_TOPIC_PAGES}-${CONTENT_CONFIG.MAX_TOPIC_PAGES} pag/argomento`);
  console.log(`===============================================\n`);
  
  try {
    progressCallback?.({ type: 'processing', message: `Fase 1/5: Ricerca indice (${analysisMode})...` });
    const indexResult = await phaseIndexSearch(examName, filesArray, originalFilesDriveInfo, userDescription, progressCallback, analysisMode);
    
    progressCallback?.({ type: 'processing', message: `Fase 2/5: Validazione indice (${analysisMode})...` });
    const validationResult = await phaseIndexValidation(examName, indexResult, filesArray, originalFilesDriveInfo, progressCallback, analysisMode);
    
    progressCallback?.({ type: 'processing', message: `Fase 3/5: Analisi pagina per pagina (${analysisMode})...` });
    const pageAnalysisResult = await phasePageByPageAnalysis(examName, indexResult, validationResult, filesArray, originalFilesDriveInfo, progressCallback, analysisMode);
    
    progressCallback?.({ type: 'processing', message: 'Fase 4/5: Raggruppamento argomenti...' });
    const topicGroupingResult = await phaseTopicGrouping(examName, pageAnalysisResult, validationResult, userDescription, progressCallback, analysisMode);
    
    progressCallback?.({ type: 'processing', message: 'Fase 5/5: Validazione finale...' });
    const finalResult = await phaseTopicValidation(topicGroupingResult, originalFilesDriveInfo, progressCallback, analysisMode);
    
    const result = {
      tableOfContents: finalResult.validatedTopics,
      pageMapping: {}, // Non più necessario con la nuova architettura
      phaseResults: {
        indexSearch: indexResult,
        indexValidation: validationResult,
        pageAnalysis: pageAnalysisResult,
        topicGrouping: topicGroupingResult,
        validation: finalResult
      },
      statistics: finalResult.statistics
    };

    console.log(`\n🎉 ===== ANALISI CONTENUTI COMPLETATA =====`);
    console.log(`✅ Modalità: ${analysisMode.toUpperCase()}`);
    console.log(`📊 Risultato: ${result.tableOfContents.length} argomenti creati`);
    console.log(`📈 Statistiche: ${result.statistics.totalAssignedPages} pagine totali, media ${result.statistics.averagePagesPerTopic} pag/argomento`);
    console.log(`===========================================\n`);

    progressCallback?.({ type: 'processing', message: `Analisi completata (${analysisMode})!` });
    return result;

  } catch (error) {
    console.error(`\n❌ ===== ERRORE ANALISI CONTENUTI =====`);
    console.error(`🔧 Modalità: ${analysisMode}`);
    console.error(`💥 Errore:`, error);
    console.error(`=====================================\n`);
    throw new Error(`Errore analisi contenuti (${analysisMode}): ${error.message}`);
  }
}