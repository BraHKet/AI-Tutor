// src/utils/gemini/modules/contentAnalysis/phase1_indexSearch.js - FASE 1: RICERCA E ANALISI INDICE

import { executeAIRequest, createAIServiceInput, validateAIServiceOutput } from '../../services/geminiAIService.js';
import { 
  logPhase,
  createPhaseError,
  executePhaseWithErrorHandling
} from '../../shared/geminiShared.js';

// ===== CONFIGURAZIONE FASE 1 =====
const PHASE1_CONFIG = {
  NAME: 'index-search',
  DESCRIPTION: 'Ricerca e analisi dell\'indice dei contenuti',
  PRIORITY: 'high',
  TIMEOUT_MS: 120000, // 2 minuti
  RETRY_COUNT: 3
};

// ===== INPUT/OUTPUT INTERFACES =====

/**
 * @typedef {Object} Phase1Input
 * @property {string} examName - Nome dell'esame
 * @property {Array} files - Array di file PDF
 * @property {string} userDescription - Descrizione utente (opzionale)
 * @property {string} analysisMode - 'pdf' o 'text'
 * @property {function} progressCallback - Callback per progress (opzionale)
 */

/**
 * @typedef {Object} Phase1Output
 * @property {Object} globalStructure - Struttura globale del materiale
 * @property {Array} documentSections - Sezioni principali identificate
 * @property {Object} indexAnalysis - Analisi dell'indice se presente
 * @property {Object} metadata - Metadati della fase
 * @property {boolean} success - Successo dell'operazione
 */

// ===== FUNZIONE PRINCIPALE FASE 1 =====

/**
 * FASE 1: Ricerca e Analisi dell'Indice
 * Identifica la struttura globale del materiale e l'eventuale indice
 * 
 * INPUT: Phase1Input
 * OUTPUT: Phase1Output
 */
export async function executePhase1IndexSearch(input) {
  const { examName, files, userDescription = '', analysisMode = 'pdf', progressCallback } = input;
  
  logPhase(PHASE1_CONFIG.NAME, `🔍 AVVIO FASE 1: Ricerca Indice (${analysisMode})`);
  logPhase(PHASE1_CONFIG.NAME, `📚 Esame: "${examName}" | 📁 File: ${files.length} | 🔧 Modalità: ${analysisMode}`);
  
  try {
    progressCallback?.({ type: 'processing', message: `Fase 1: Ricerca indice e struttura globale (${analysisMode})...` });
    
    const result = await executePhaseWithErrorHandling(
      PHASE1_CONFIG.NAME,
      performIndexSearchAnalysis,
      { examName, files, userDescription, analysisMode, progressCallback },
      PHASE1_CONFIG.RETRY_COUNT
    );
    
    // Validazione output
    validatePhase1Output(result);
    
    logPhase(PHASE1_CONFIG.NAME, `✅ FASE 1 COMPLETATA: Struttura identificata, ${result.documentSections?.length || 0} sezioni trovate`);
    progressCallback?.({ type: 'processing', message: 'Fase 1: Analisi indice completata!' });
    
    return {
      ...result,
      phaseMetadata: {
        phaseName: PHASE1_CONFIG.NAME,
        phaseDescription: PHASE1_CONFIG.DESCRIPTION,
        analysisMode: analysisMode,
        timestamp: Date.now(),
        success: true
      }
    };
    
  } catch (error) {
    logPhase(PHASE1_CONFIG.NAME, `❌ FASE 1 FALLITA: ${error.message}`);
    throw createPhaseError(PHASE1_CONFIG.NAME, `Errore Fase 1 (${analysisMode}): ${error.message}`, error);
  }
}

// ===== IMPLEMENTAZIONE CORE =====

/**
 * Esegue l'analisi di ricerca dell'indice
 */
async function performIndexSearchAnalysis({ examName, files, userDescription, analysisMode, progressCallback }) {
  const filesList = files
    .map((file, index) => `${index + 1}. ${file.name} (${Math.round(file.size / 1024 / 1024)} MB)`)
    .join('\n');

  const modeNote = analysisMode === 'text' 
    ? '\n\nMODALITÀ TESTO: Analizza il contenuto testuale per identificare struttura e indice.'
    : '\n\nMODALITÀ PDF: Analizza completamente includendo layout visivo per identificare indice e struttura.';

  const prompt = `Sei un AI tutor esperto nella ricerca e analisi di indici e strutture di materiale didattico.

COMPITO: Analizza questo materiale per l'esame "${examName}" e identifica COMPLETAMENTE la struttura globale e l'eventuale indice.

FILE DA ANALIZZARE:
${filesList}

${userDescription ? `OBIETTIVI SPECIFICI: "${userDescription}"` : ''}${modeNote}

STRATEGIA DI RICERCA INDICE:
1. **CERCA INDICE GENERALE**: Identifica se esiste un indice/sommario principale
2. **MAPPA STRUTTURA GLOBALE**: Comprendi l'organizzazione generale del materiale
3. **IDENTIFICA SEZIONI PRINCIPALI**: Trova capitoli, parti, appendici
4. **RILEVA ELEMENTI STRUTTURALI**: Trova bibliografia, esercizi, formule
5. **LOCALIZZA CON PRECISIONE**: Indica numeri di pagina esatti per ogni elemento

REGOLE FONDAMENTALI:
- Se trovi un indice, mappalo COMPLETAMENTE
- Identifica TUTTE le sezioni principali visibili
- Mantieni precisione assoluta sui numeri di pagina
- Distingui tra contenuto teorico, esercizi, appendici
- Segnala presenza di formule, grafici, tabelle

JSON RICHIESTO:

{
  "globalStructure": {
    "totalFiles": ${files.length},
    "materialType": "textbook|slides|notes|mixed|exercises|manual",
    "overallOrganization": "descrizione dettagliata dell'organizzazione del materiale",
    "estimatedTotalPages": 0,
    "hasMainIndex": true,
    "indexLocation": {
      "fileIndex": 0,
      "startPage": 1,
      "endPage": 5,
      "indexType": "detailed|summary|chapter_list|none"
    },
    "documentFlow": "descrizione del flusso logico del documento",
    "primaryLanguage": "italian|english|mixed",
    "academicLevel": "undergraduate|graduate|advanced|introductory"
  },
  "documentSections": [
    {
      "sectionId": "section_001",
      "sectionTitle": "Nome sezione (es. Capitolo 1, Parte A, etc.)",
      "sectionType": "introduction|chapter|part|appendix|exercises|bibliography|index|formulas",
      "fileIndex": 0,
      "startPage": 1,
      "endPage": 25,
      "importance": "critical|high|medium|low",
      "description": "Descrizione dettagliata del contenuto di questa sezione",
      "subSections": [
        {
          "subTitle": "Sottosezione se identificabile",
          "startPage": 5,
          "endPage": 12,
          "topicArea": "area tematica della sottosezione"
        }
      ],
      "estimatedComplexity": "beginner|intermediate|advanced",
      "hasExercises": false,
      "hasFormulas": true,
      "hasImages": false,
      "keyTopicsPreview": ["anteprima argomenti chiave se identificabili"]
    }
  ],
  "indexAnalysis": {
    "indexFound": true,
    "indexQuality": "excellent|good|basic|poor|none",
    "indexEntries": [
      {
        "entryTitle": "Voce indice esatta come appare",
        "pageReference": "12-18",
        "entryType": "chapter|section|topic|formula|exercise",
        "level": 1,
        "parentEntry": "eventuale voce padre"
      }
    ],
    "indexStructure": {
      "hasChapterNumbers": true,
      "hasSubTopics": true,
      "hasPageRanges": true,
      "hierarchicalLevels": 3,
      "totalEntries": 45
    },
    "indexUtility": "high|medium|low"
  },
  "structuralElements": [
    {
      "elementType": "preface|introduction|conclusions|appendix|bibliography|exercises|formulas|glossary",
      "elementTitle": "Nome elemento",
      "fileIndex": 0,
      "startPage": 1,
      "endPage": 3,
      "importance": "high|medium|low",
      "description": "Descrizione dell'elemento strutturale"
    }
  ],
  "analysisMetadata": {
    "searchStrategy": "strategia utilizzata per la ricerca",
    "confidenceLevel": "0.0-1.0",
    "analysisDepth": "surface|moderate|deep",
    "limitationsFound": ["eventuali limitazioni nell'analisi"],
    "recommendedNextSteps": ["suggerimenti per l'analisi successiva"]
  }
}

IMPORTANTE:
- Se NON trovi un indice, segnalalo chiaramente in "indexFound": false
- Sii ESTREMAMENTE preciso sui numeri di pagina
- Distingui chiaramente tra diversi tipi di contenuto
- Se una sezione contiene più argomenti, evidenzialo in keyTopicsPreview
- L'analisi deve essere COMPLETA per ogni file fornito`;

  const aiInput = createAIServiceInput(prompt, files, analysisMode, PHASE1_CONFIG.NAME, progressCallback);
  const result = await executeAIRequest(aiInput);
  
  validateAIServiceOutput(result, ['globalStructure', 'documentSections']);
  
  // Log risultato per debug
  logPhase(PHASE1_CONFIG.NAME, `📊 Struttura identificata:`, {
    materialType: result.data.globalStructure?.materialType,
    totalSections: result.data.documentSections?.length,
    hasIndex: result.data.indexAnalysis?.indexFound,
    analysisMode: analysisMode
  });
  
  return result.data;
}

// ===== VALIDAZIONI =====

/**
 * Valida l'output della Fase 1
 */
function validatePhase1Output(output) {
  if (!output || typeof output !== 'object') {
    throw createPhaseError(PHASE1_CONFIG.NAME, 'Output Fase 1 deve essere un oggetto');
  }
  
  // Validazione globalStructure
  if (!output.globalStructure) {
    throw createPhaseError(PHASE1_CONFIG.NAME, 'globalStructure mancante nell\'output Fase 1');
  }
  
  const globalStructure = output.globalStructure;
  if (!globalStructure.materialType || !globalStructure.overallOrganization) {
    throw createPhaseError(PHASE1_CONFIG.NAME, 'globalStructure incompleta: mancano materialType o overallOrganization');
  }
  
  // Validazione documentSections
  if (!Array.isArray(output.documentSections)) {
    throw createPhaseError(PHASE1_CONFIG.NAME, 'documentSections deve essere un array');
  }
  
  // Validazione struttura sezioni
  output.documentSections.forEach((section, index) => {
    if (!section.sectionTitle || !section.sectionType) {
      throw createPhaseError(PHASE1_CONFIG.NAME, `Sezione ${index} incompleta: mancano sectionTitle o sectionType`);
    }
    
    if (typeof section.startPage !== 'number' || typeof section.endPage !== 'number') {
      throw createPhaseError(PHASE1_CONFIG.NAME, `Sezione ${index}: startPage e endPage devono essere numeri`);
    }
    
    if (section.startPage > section.endPage) {
      throw createPhaseError(PHASE1_CONFIG.NAME, `Sezione ${index}: startPage (${section.startPage}) > endPage (${section.endPage})`);
    }
  });
  
  // Validazione indexAnalysis (opzionale ma se presente deve essere valida)
  if (output.indexAnalysis) {
    if (typeof output.indexAnalysis.indexFound !== 'boolean') {
      throw createPhaseError(PHASE1_CONFIG.NAME, 'indexAnalysis.indexFound deve essere boolean');
    }
  }
  
  logPhase(PHASE1_CONFIG.NAME, '✅ Validazione Fase 1 completata con successo');
  return true;
}

// ===== UTILITÀ FASE 1 =====

/**
 * Crea input standardizzato per la Fase 1
 */
export function createPhase1Input(examName, files, userDescription = '', analysisMode = 'pdf', progressCallback = null) {
  return {
    examName: examName.trim(),
    files: Array.isArray(files) ? files : [],
    userDescription: userDescription.trim(),
    analysisMode: ['pdf', 'text'].includes(analysisMode) ? analysisMode : 'pdf',
    progressCallback: progressCallback,
    timestamp: Date.now()
  };
}

/**
 * Verifica se l'output della Fase 1 è valido
 */
export function isPhase1OutputValid(output) {
  try {
    validatePhase1Output(output);
    return true;
  } catch (error) {
    logPhase(PHASE1_CONFIG.NAME, `❌ Output non valido: ${error.message}`);
    return false;
  }
}

/**
 * Estrae statistiche dall'output della Fase 1
 */
export function extractPhase1Statistics(output) {
  if (!isPhase1OutputValid(output)) {
    return null;
  }
  
  const sections = output.documentSections || [];
  const indexAnalysis = output.indexAnalysis || {};
  
  return {
    totalSections: sections.length,
    sectionTypes: sections.reduce((acc, section) => {
      acc[section.sectionType] = (acc[section.sectionType] || 0) + 1;
      return acc;
    }, {}),
    hasIndex: indexAnalysis.indexFound || false,
    indexQuality: indexAnalysis.indexQuality || 'none',
    totalIndexEntries: indexAnalysis.indexEntries?.length || 0,
    materialType: output.globalStructure?.materialType || 'unknown',
    estimatedPages: output.globalStructure?.estimatedTotalPages || 0,
    academicLevel: output.globalStructure?.academicLevel || 'unknown',
    analysisConfidence: output.analysisMetadata?.confidenceLevel || 0.5
  };
}

/**
 * Genera summary user-friendly dell'output Fase 1
 */
export function generatePhase1Summary(output) {
  const stats = extractPhase1Statistics(output);
  
  if (!stats) {
    return 'Errore: Impossibile generare summary per output non valido';
  }
  
  const sections = Object.entries(stats.sectionTypes)
    .map(([type, count]) => `${count} ${type}`)
    .join(', ');
  
  const indexInfo = stats.hasIndex 
    ? `Indice presente (${stats.indexQuality}, ${stats.totalIndexEntries} voci)`
    : 'Nessun indice identificato';
  
  return `Materiale: ${stats.materialType} (${stats.academicLevel})
Sezioni: ${stats.totalSections} (${sections})
${indexInfo}
Pagine stimate: ${stats.estimatedPages}
Confidenza analisi: ${Math.round(stats.analysisConfidence * 100)}%`;
}

// ===== EXPORT DEFAULT =====
export default {
  executePhase1IndexSearch,
  createPhase1Input,
  isPhase1OutputValid,
  validatePhase1Output,
  extractPhase1Statistics,
  generatePhase1Summary,
  PHASE1_CONFIG
};

// ===== LOGGING =====
logPhase('system', `📍 FASE 1 MODULE CARICATO: ${PHASE1_CONFIG.NAME} - ${PHASE1_CONFIG.DESCRIPTION}`);