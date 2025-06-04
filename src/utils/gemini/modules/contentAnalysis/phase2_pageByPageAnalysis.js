// src/utils/gemini/modules/contentAnalysis/phase2_pageByPageAnalysis.js - FASE 2: ANALISI DETTAGLIATA PAGINA PER PAGINA

import { executeAIRequest, createAIServiceInput, validateAIServiceOutput } from '../../services/geminiAIService.js';
import { 
  logPhase,
  createPhaseError,
  executePhaseWithErrorHandling
} from '../../shared/geminiShared.js';

// ===== CONFIGURAZIONE FASE 2 =====
const PHASE2_CONFIG = {
  NAME: 'page-by-page-analysis',
  DESCRIPTION: 'Analisi dettagliata pagina per pagina del contenuto',
  PRIORITY: 'critical',
  TIMEOUT_MS: 300000, // 5 minuti
  RETRY_COUNT: 3,
  MAX_PAGES_PER_BATCH: 50 // Per gestire grandi documenti
};

// ===== INPUT/OUTPUT INTERFACES =====

/**
 * @typedef {Object} Phase2Input
 * @property {string} examName - Nome dell'esame
 * @property {Array} files - Array di file PDF
 * @property {Object} phase1Output - Output della Fase 1
 * @property {string} userDescription - Descrizione utente (opzionale)
 * @property {string} analysisMode - 'pdf' o 'text'
 * @property {function} progressCallback - Callback per progress (opzionale)
 */

/**
 * @typedef {Object} Phase2Output
 * @property {Array} pageByPageAnalysis - Analisi dettagliata di ogni pagina
 * @property {Object} contentSummary - Riassunto del contenuto analizzato
 * @property {Object} qualityMetrics - Metriche di qualità dell'analisi
 * @property {Object} metadata - Metadati della fase
 * @property {boolean} success - Successo dell'operazione
 */

// ===== FUNZIONE PRINCIPALE FASE 2 =====

/**
 * FASE 2: Analisi Dettagliata Pagina per Pagina
 * Analizza in dettaglio ogni singola pagina del materiale
 * 
 * INPUT: Phase2Input
 * OUTPUT: Phase2Output
 */
export async function executePhase2PageByPageAnalysis(input) {
  const { examName, files, phase1Output, userDescription = '', analysisMode = 'pdf', progressCallback } = input;
  
  logPhase(PHASE2_CONFIG.NAME, `🔍 AVVIO FASE 2: Analisi Pagina per Pagina (${analysisMode})`);
  logPhase(PHASE2_CONFIG.NAME, `📚 Esame: "${examName}" | 📁 File: ${files.length} | 🔧 Modalità: ${analysisMode}`);
  
  try {
    // Validazione prerequisiti
    validatePhase2Prerequisites(phase1Output);
    
    progressCallback?.({ type: 'processing', message: `Fase 2: Analisi dettagliata pagina per pagina (${analysisMode})...` });
    
    const result = await executePhaseWithErrorHandling(
      PHASE2_CONFIG.NAME,
      performPageByPageAnalysis,
      { examName, files, phase1Output, userDescription, analysisMode, progressCallback },
      PHASE2_CONFIG.RETRY_COUNT
    );
    
    // Validazione output
    validatePhase2Output(result);
    
    logPhase(PHASE2_CONFIG.NAME, `✅ FASE 2 COMPLETATA: ${result.pageByPageAnalysis?.length || 0} pagine analizzate`);
    progressCallback?.({ type: 'processing', message: 'Fase 2: Analisi pagina per pagina completata!' });
    
    return {
      ...result,
      phaseMetadata: {
        phaseName: PHASE2_CONFIG.NAME,
        phaseDescription: PHASE2_CONFIG.DESCRIPTION,
        analysisMode: analysisMode,
        timestamp: Date.now(),
        pagesAnalyzed: result.pageByPageAnalysis?.length || 0,
        success: true
      }
    };
    
  } catch (error) {
    logPhase(PHASE2_CONFIG.NAME, `❌ FASE 2 FALLITA: ${error.message}`);
    throw createPhaseError(PHASE2_CONFIG.NAME, `Errore Fase 2 (${analysisMode}): ${error.message}`, error);
  }
}

// ===== IMPLEMENTAZIONE CORE =====

/**
 * Esegue l'analisi dettagliata pagina per pagina
 */
async function performPageByPageAnalysis({ examName, files, phase1Output, userDescription, analysisMode, progressCallback }) {
  // Prepara contesto dalla Fase 1
  const contextFromPhase1 = preparePhase1Context(phase1Output);
  
  const filesList = files
    .map((file, index) => `${index + 1}. ${file.name} (${Math.round(file.size / 1024 / 1024)} MB)`)
    .join('\n');

  const modeNote = analysisMode === 'text' 
    ? '\n\nMODALITÀ TESTO: Analizza il contenuto testuale di ogni pagina in dettaglio.'
    : '\n\nMODALITÀ PDF: Analizza ogni pagina includendo elementi visivi, layout, formule e grafici.';

  const prompt = `Sei un AI tutor esperto nell'analisi dettagliata pagina per pagina di materiale didattico.

COMPITO: Analizza DETTAGLIATAMENTE OGNI SINGOLA PAGINA di questo materiale per l'esame "${examName}".

FILE DA ANALIZZARE:
${filesList}

CONTESTO DALLA FASE 1 (Struttura Globale):
${contextFromPhase1}

${userDescription ? `OBIETTIVI SPECIFICI: "${userDescription}"` : ''}${modeNote}

STRATEGIA ANALISI DETTAGLIATA:
1. **ANALIZZA OGNI PAGINA SINGOLARMENTE**: Non saltare nessuna pagina
2. **IDENTIFICA CONTENUTO SPECIFICO**: Argomenti, concetti, esempi per ogni pagina
3. **CLASSIFICA TIPO CONTENUTO**: Teoria, esercizi, esempi, formule, grafici
4. **VALUTA DIFFICOLTÀ**: Livello di complessità di ogni pagina
5. **ESTRAI ELEMENTI CHIAVE**: Termini, concetti, prerequisiti specifici
6. **STIMA TEMPO STUDIO**: Tempo necessario per studiare ogni pagina

REGOLE FONDAMENTALI:
- UNA ENTRY per OGNI pagina di OGNI file
- Numera le pagine in modo preciso e sequenziale
- Sii specifico su COSA si trova in ogni pagina
- Identifica collegamenti tra pagine consecutive
- Mantieni coerenza con la struttura identificata nella Fase 1

JSON RICHIESTO:

{
  "pageByPageAnalysis": [
    {
      "fileIndex": 0,
      "fileName": "nome.pdf",
      "pageNumber": 1,
      "pageTitle": "Titolo della pagina o sezione (se identificabile dal contenuto)",
      "sectionContext": "A quale sezione appartiene (basato su Fase 1)",
      "contentType": "theory|examples|exercises|mixed|index|appendix|formulas|images|tables",
      "primaryTopics": [
        {
          "topicName": "Nome specifico argomento principale",
          "description": "Descrizione dettagliata dell'argomento",
          "importance": "critical|high|medium|low",
          "keyPoints": ["punto chiave 1", "punto chiave 2", "punto chiave 3"],
          "conceptType": "definition|theorem|example|exercise|formula|application"
        }
      ],
      "secondaryTopics": [
        {
          "topicName": "Argomento secondario se presente",
          "description": "Breve descrizione",
          "relationship": "support|prerequisite|extension|example"
        }
      ],
      "difficulty": "beginner|intermediate|advanced",
      "cognitiveLoad": "low|medium|high",
      "studyIntensity": "light|moderate|intensive",
      "estimatedStudyTimeMinutes": 30,
      "contentElements": {
        "hasFormulas": true,
        "formulaCount": 3,
        "hasExercises": false,
        "exerciseCount": 0,
        "hasImages": false,
        "imageCount": 0,
        "hasTables": false,
        "tableCount": 0,
        "hasGraphs": false,
        "graphCount": 0,
        "textDensity": "low|medium|high"
      },
      "keyTerms": ["termine1", "termine2", "termine3"],
      "prerequisites": ["prerequisito1", "prerequisito2"],
      "learningObjectives": ["cosa lo studente dovrebbe imparare da questa pagina"],
      "connections": {
        "previousPages": ["collegamenti con pagine precedenti"],
        "nextPages": ["anticipazioni per pagine successive"],
        "conceptualLinks": ["collegamenti concettuali con altre parti"]
      },
      "studyRecommendations": {
        "studyMethod": "reading|practice|memorization|analysis|application",
        "focusAreas": ["aree su cui concentrarsi"],
        "commonDifficulties": ["difficoltà comuni per gli studenti"],
        "studyTips": "Suggerimenti specifici per studiare questa pagina"
      },
      "qualityIndicators": {
        "contentClarity": "excellent|good|fair|poor",
        "conceptDensity": "low|medium|high",
        "practicalRelevance": "high|medium|low",
        "examRelevance": "critical|important|useful|peripheral"
      }
    }
  ],
  "contentSummary": {
    "totalPagesAnalyzed": 0,
    "fileDistribution": {
      "file0": 25,
      "file1": 30
    },
    "contentTypeDistribution": {
      "theory": 40,
      "examples": 15,
      "exercises": 10,
      "mixed": 8,
      "formulas": 5,
      "other": 2
    },
    "difficultyDistribution": {
      "beginner": 20,
      "intermediate": 45,
      "advanced": 15
    },
    "specialElements": {
      "totalFormulas": 45,
      "totalExercises": 23,
      "totalImages": 12,
      "totalTables": 8,
      "totalGraphs": 6
    },
    "estimatedTotalStudyHours": 12.5,
    "averageStudyTimePerPage": 15.5,
    "cognitiveLoadDistribution": {
      "low": 25,
      "medium": 40,
      "high": 15
    }
  },
  "qualityMetrics": {
    "analysisCompleteness": "0.0-1.0",
    "contentCoverage": "0.0-1.0",
    "detailLevel": "surface|moderate|deep",
    "consistencyScore": "0.0-1.0",
    "reliabilityIndicators": {
      "clearContentIdentification": true,
      "consistentClassification": true,
      "logicalProgression": true,
      "timeEstimationRealism": true
    }
  },
  "analysisMetadata": {
    "analysisMode": "${analysisMode}",
    "processingStrategy": "Strategia utilizzata per l'analisi",
    "limitationsEncountered": ["eventuali limitazioni"],
    "confidenceLevel": "0.0-1.0",
    "recommendationsForPhase3": ["suggerimenti per la fase successiva"]
  }
}

IMPORTANTE:
- OGNI pagina deve avere una entry in pageByPageAnalysis
- Sii SPECIFICO su cosa contiene ogni pagina
- Non generalizzare: ogni pagina è unica
- Mantieni coerenza nella numerazione delle pagine
- Collega l'analisi alla struttura identificata nella Fase 1
- Se una pagina è "vuota" o di transizione, documentalo comunque`;

  const aiInput = createAIServiceInput(prompt, files, analysisMode, PHASE2_CONFIG.NAME, progressCallback);
  const result = await executeAIRequest(aiInput);
  
  validateAIServiceOutput(result, ['pageByPageAnalysis', 'contentSummary']);
  
  // Post-processing per migliorare la qualità
  const enhancedResult = enhancePageAnalysisWithPhase1Context(result.data, phase1Output);
  
  // Log risultato per debug
  logPhase(PHASE2_CONFIG.NAME, `📊 Analisi pagine completata:`, {
    totalPages: enhancedResult.pageByPageAnalysis?.length,
    contentTypes: enhancedResult.contentSummary?.contentTypeDistribution,
    analysisMode: analysisMode
  });
  
  return enhancedResult;
}

// ===== PROCESSING E ENHANCEMENT =====

/**
 * Prepara il contesto dalla Fase 1 per l'analisi della Fase 2
 */
function preparePhase1Context(phase1Output) {
  if (!phase1Output) return 'Nessun contesto dalla Fase 1 disponibile.';
  
  const globalStructure = phase1Output.globalStructure || {};
  const sections = phase1Output.documentSections || [];
  const indexAnalysis = phase1Output.indexAnalysis || {};
  
  let context = `STRUTTURA GLOBALE IDENTIFICATA:
- Tipo materiale: ${globalStructure.materialType || 'non specificato'}
- Organizzazione: ${globalStructure.overallOrganization || 'non specificata'}
- Livello accademico: ${globalStructure.academicLevel || 'non specificato'}
- Ha indice principale: ${globalStructure.hasMainIndex ? 'Sì' : 'No'}

SEZIONI PRINCIPALI IDENTIFICATE:`;
  
  sections.forEach((section, index) => {
    context += `\n${index + 1}. ${section.sectionTitle} (${section.sectionType})`;
    context += `\n   - File ${section.fileIndex}, Pagine ${section.startPage}-${section.endPage}`;
    context += `\n   - Importanza: ${section.importance}, Complessità: ${section.estimatedComplexity || 'non specificata'}`;
    if (section.keyTopicsPreview && section.keyTopicsPreview.length > 0) {
      context += `\n   - Argomenti chiave: ${section.keyTopicsPreview.join(', ')}`;
    }
  });
  
  if (indexAnalysis.indexFound) {
    context += `\n\nINDICE IDENTIFICATO:
- Qualità: ${indexAnalysis.indexQuality}
- Voci totali: ${indexAnalysis.indexEntries?.length || 0}
- Utilità: ${indexAnalysis.indexUtility}`;
  }
  
  return context;
}

/**
 * Migliora l'analisi delle pagine con il contesto della Fase 1
 */
function enhancePageAnalysisWithPhase1Context(result, phase1Output) {
  if (!result.pageByPageAnalysis || !phase1Output) return result;
  
  const sections = phase1Output.documentSections || [];
  
  // Crea mappa delle sezioni per file e pagina
  const sectionMap = new Map();
  sections.forEach(section => {
    for (let page = section.startPage; page <= section.endPage; page++) {
      const key = `${section.fileIndex}-${page}`;
      sectionMap.set(key, section);
    }
  });
  
  // Arricchisce ogni pagina con il contesto della sezione
  const enhancedPages = result.pageByPageAnalysis.map(page => {
    const sectionKey = `${page.fileIndex}-${page.pageNumber}`;
    const relatedSection = sectionMap.get(sectionKey);
    
    if (relatedSection) {
      return {
        ...page,
        sectionContext: `${relatedSection.sectionTitle} (${relatedSection.sectionType})`,
        sectionImportance: relatedSection.importance,
        sectionComplexity: relatedSection.estimatedComplexity,
        // Aggiusta priorità in base alla sezione
        qualityIndicators: {
          ...page.qualityIndicators,
          examRelevance: adjustExamRelevanceBasedOnSection(page.qualityIndicators?.examRelevance, relatedSection.importance)
        }
      };
    }
    
    return page;
  });
  
  return {
    ...result,
    pageByPageAnalysis: enhancedPages,
    enhancement: {
      sectionsMatched: enhancedPages.filter(p => p.sectionContext).length,
      totalPages: enhancedPages.length,
      enhancementApplied: true
    }
  };
}

/**
 * Aggiusta la rilevanza per l'esame basandosi sull'importanza della sezione
 */
function adjustExamRelevanceBasedOnSection(currentRelevance, sectionImportance) {
  if (sectionImportance === 'critical') return 'critical';
  if (sectionImportance === 'high' && currentRelevance !== 'critical') return 'important';
  if (sectionImportance === 'low') return 'peripheral';
  return currentRelevance || 'useful';
}

// ===== VALIDAZIONI =====

/**
 * Valida i prerequisiti per la Fase 2
 */
function validatePhase2Prerequisites(phase1Output) {
  if (!phase1Output) {
    throw createPhaseError(PHASE2_CONFIG.NAME, 'Output Fase 1 mancante per eseguire Fase 2');
  }
  
  if (!phase1Output.globalStructure) {
    throw createPhaseError(PHASE2_CONFIG.NAME, 'globalStructure mancante nell\'output Fase 1');
  }
  
  if (!Array.isArray(phase1Output.documentSections)) {
    throw createPhaseError(PHASE2_CONFIG.NAME, 'documentSections deve essere un array nell\'output Fase 1');
  }
  
  logPhase(PHASE2_CONFIG.NAME, '✅ Prerequisiti Fase 2 validati');
  return true;
}

/**
 * Valida l'output della Fase 2
 */
function validatePhase2Output(output) {
  if (!output || typeof output !== 'object') {
    throw createPhaseError(PHASE2_CONFIG.NAME, 'Output Fase 2 deve essere un oggetto');
  }
  
  // Validazione pageByPageAnalysis
  if (!Array.isArray(output.pageByPageAnalysis)) {
    throw createPhaseError(PHASE2_CONFIG.NAME, 'pageByPageAnalysis deve essere un array');
  }
  
  if (output.pageByPageAnalysis.length === 0) {
    throw createPhaseError(PHASE2_CONFIG.NAME, 'pageByPageAnalysis non può essere vuoto');
  }
  
  // Validazione struttura singole pagine
  output.pageByPageAnalysis.forEach((page, index) => {
    if (!page.fileIndex && page.fileIndex !== 0) {
      throw createPhaseError(PHASE2_CONFIG.NAME, `Pagina ${index}: fileIndex mancante`);
    }
    
    if (!page.pageNumber || typeof page.pageNumber !== 'number') {
      throw createPhaseError(PHASE2_CONFIG.NAME, `Pagina ${index}: pageNumber deve essere un numero`);
    }
    
    if (!page.contentType) {
      throw createPhaseError(PHASE2_CONFIG.NAME, `Pagina ${index}: contentType mancante`);
    }
    
    if (!Array.isArray(page.primaryTopics)) {
      throw createPhaseError(PHASE2_CONFIG.NAME, `Pagina ${index}: primaryTopics deve essere un array`);
    }
  });
  
  // Validazione contentSummary
  if (!output.contentSummary) {
    throw createPhaseError(PHASE2_CONFIG.NAME, 'contentSummary mancante');
  }
  
  const summary = output.contentSummary;
  if (typeof summary.totalPagesAnalyzed !== 'number' || summary.totalPagesAnalyzed <= 0) {
    throw createPhaseError(PHASE2_CONFIG.NAME, 'contentSummary.totalPagesAnalyzed deve essere un numero positivo');
  }
  
  // Verifica coerenza
  if (summary.totalPagesAnalyzed !== output.pageByPageAnalysis.length) {
    logPhase(PHASE2_CONFIG.NAME, `⚠️ ATTENZIONE: Discrepanza tra totalPagesAnalyzed (${summary.totalPagesAnalyzed}) e pageByPageAnalysis.length (${output.pageByPageAnalysis.length})`);
  }
  
  logPhase(PHASE2_CONFIG.NAME, '✅ Validazione Fase 2 completata con successo');
  return true;
}

// ===== UTILITÀ FASE 2 =====

/**
 * Crea input standardizzato per la Fase 2
 */
export function createPhase2Input(examName, files, phase1Output, userDescription = '', analysisMode = 'pdf', progressCallback = null) {
  return {
    examName: examName.trim(),
    files: Array.isArray(files) ? files : [],
    phase1Output: phase1Output,
    userDescription: userDescription.trim(),
    analysisMode: ['pdf', 'text'].includes(analysisMode) ? analysisMode : 'pdf',
    progressCallback: progressCallback,
    timestamp: Date.now()
  };
}

/**
 * Verifica se l'output della Fase 2 è valido
 */
export function isPhase2OutputValid(output) {
  try {
    validatePhase2Output(output);
    return true;
  } catch (error) {
    logPhase(PHASE2_CONFIG.NAME, `❌ Output non valido: ${error.message}`);
    return false;
  }
}

/**
 * Estrae statistiche dall'output della Fase 2
 */
export function extractPhase2Statistics(output) {
  if (!isPhase2OutputValid(output)) {
    return null;
  }
  
  const pages = output.pageByPageAnalysis || [];
  const summary = output.contentSummary || {};
  
  // Calcola statistiche sui contenuti
  const contentTypes = pages.reduce((acc, page) => {
    acc[page.contentType] = (acc[page.contentType] || 0) + 1;
    return acc;
  }, {});
  
  const difficulties = pages.reduce((acc, page) => {
    acc[page.difficulty] = (acc[page.difficulty] || 0) + 1;
    return acc;
  }, {});
  
  const cognitiveLoads = pages.reduce((acc, page) => {
    acc[page.cognitiveLoad] = (acc[page.cognitiveLoad] || 0) + 1;
    return acc;
  }, {});
  
  // Calcola tempo di studio totale
  const totalStudyMinutes = pages.reduce((sum, page) => {
    return sum + (page.estimatedStudyTimeMinutes || 0);
  }, 0);
  
  return {
    totalPages: pages.length,
    contentTypeDistribution: contentTypes,
    difficultyDistribution: difficulties,
    cognitiveLoadDistribution: cognitiveLoads,
    estimatedStudyHours: Math.round((totalStudyMinutes / 60) * 10) / 10,
    averageStudyTimePerPage: pages.length > 0 ? Math.round((totalStudyMinutes / pages.length) * 10) / 10 : 0,
    specialElements: summary.specialElements || {},
    qualityScore: output.qualityMetrics?.analysisCompleteness || 0,
    enhancementApplied: output.enhancement?.enhancementApplied || false
  };
}

/**
 * Trova pagine per tipo di contenuto
 */
export function findPagesByContentType(output, contentType) {
  if (!isPhase2OutputValid(output)) {
    return [];
  }
  
  return output.pageByPageAnalysis.filter(page => page.contentType === contentType);
}

/**
 * Trova pagine per difficoltà
 */
export function findPagesByDifficulty(output, difficulty) {
  if (!isPhase2OutputValid(output)) {
    return [];
  }
  
  return output.pageByPageAnalysis.filter(page => page.difficulty === difficulty);
}

/**
 * Trova pagine con elementi speciali (formule, esercizi, etc.)
 */
export function findPagesWithSpecialElements(output, elementType) {
  if (!isPhase2OutputValid(output)) {
    return [];
  }
  
  const elementMap = {
    'formulas': 'hasFormulas',
    'exercises': 'hasExercises',
    'images': 'hasImages',
    'tables': 'hasTables',
    'graphs': 'hasGraphs'
  };
  
  const property = elementMap[elementType];
  if (!property) return [];
  
  return output.pageByPageAnalysis.filter(page => 
    page.contentElements && page.contentElements[property]
  );
}

/**
 * Genera summary user-friendly dell'output Fase 2
 */
export function generatePhase2Summary(output) {
  const stats = extractPhase2Statistics(output);
  
  if (!stats) {
    return 'Errore: Impossibile generare summary per output non valido';
  }
  
  const contentTypes = Object.entries(stats.contentTypeDistribution)
    .map(([type, count]) => `${count} ${type}`)
    .join(', ');
  
  const difficulties = Object.entries(stats.difficultyDistribution)
    .map(([level, count]) => `${count} ${level}`)
    .join(', ');
  
  return `Analisi dettagliata: ${stats.totalPages} pagine
Contenuti: ${contentTypes}
Difficoltà: ${difficulties}
Tempo studio stimato: ${stats.estimatedStudyHours} ore (${stats.averageStudyTimePerPage} min/pagina)
Elementi speciali: ${stats.specialElements.totalFormulas || 0} formule, ${stats.specialElements.totalExercises || 0} esercizi
Qualità analisi: ${Math.round(stats.qualityScore * 100)}%`;
}

/**
 * Ottiene pagine per sezione (se disponibile enhancement)
 */
export function getPagesBySection(output) {
  if (!isPhase2OutputValid(output)) {
    return {};
  }
  
  const sections = {};
  
  output.pageByPageAnalysis.forEach(page => {
    if (page.sectionContext) {
      if (!sections[page.sectionContext]) {
        sections[page.sectionContext] = [];
      }
      sections[page.sectionContext].push(page);
    }
  });
  
  return sections;
}

// ===== EXPORT DEFAULT =====
export default {
  executePhase2PageByPageAnalysis,
  createPhase2Input,
  isPhase2OutputValid,
  validatePhase2Output,
  validatePhase2Prerequisites,
  extractPhase2Statistics,
  generatePhase2Summary,
  findPagesByContentType,
  findPagesByDifficulty,
  findPagesWithSpecialElements,
  getPagesBySection,
  PHASE2_CONFIG
};

// ===== LOGGING =====
logPhase('system', `📍 FASE 2 MODULE CARICATO: ${PHASE2_CONFIG.NAME} - ${PHASE2_CONFIG.DESCRIPTION}`);