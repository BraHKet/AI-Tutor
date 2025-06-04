// src/utils/gemini/modules/contentAnalysis/phase1_indexSearch.js

import { executeAIRequest, createAIServiceInput, validateAIServiceOutput } from '../../services/geminiAIService.js';
import { createPhaseError } from '../../shared/geminiShared.js';

/**
 * FASE 1: Ricerca e Analisi dell'Indice (LEGGERA)
 * INPUT: examName, files, userDescription, analysisMode, progressCallback
 * OUTPUT: Struttura globale e mappatura dell'indice
 */
export async function performInitialIndexSearch(input) {
  const { examName, files, userDescription, analysisMode, progressCallback } = input;
  
  const filesList = files
    .map((file, index) => `${index + 1}. ${file.name} (${Math.round(file.size / 1024 / 1024)} MB)`)
    .join('\n');

  const modeNote = analysisMode === 'text' 
    ? '\n\nMODALITÀ TESTO: Cerca indice e struttura nel contenuto testuale.'
    : '\n\nMODALITÀ PDF: Cerca indice e struttura includendo layout visivo.';

  const prompt = `Sei un AI tutor esperto nella ricerca di indici e strutture di materiale didattico per l'esame "${examName}".

COMPITO: Identifica SOLO la struttura globale e l'eventuale indice del materiale.

FILE DA ANALIZZARE:
${filesList}

${userDescription ? `OBIETTIVI SPECIFICI: "${userDescription}"` : ''}${modeNote}

REGOLE:
- CERCA solo indice/sommario generale
- IDENTIFICA struttura principale (capitoli, sezioni)
- NON analizzare contenuto dettagliato
- MANTIENI analisi LEGGERA e veloce

JSON RICHIESTO:

{
  "globalStructure": {
    "totalFiles": ${files.length},
    "materialType": "textbook|slides|notes|mixed|exercises",
    "overallOrganization": "descrizione organizzazione generale",
    "estimatedTotalPages": 0,
    "hasMainIndex": true,
    "indexLocation": {
      "fileIndex": 0,
      "startPage": 1,
      "endPage": 5,
      "indexType": "detailed|summary|chapter_list|none"
    },
    "mainSections": [
      {
        "sectionTitle": "Nome sezione principale",
        "fileIndex": 0,
        "startPage": 1,
        "endPage": 25,
        "sectionType": "introduction|chapter|appendix|exercises|index",
        "importance": "high|medium|low",
        "description": "Descrizione della sezione"
      }
    ]
  },
  "indexAnalysis": {
    "indexFound": true,
    "indexQuality": "excellent|good|basic|poor|none",
    "totalEntries": 0,
    "indexUtility": "high|medium|low"
  },
  "analysisMetadata": {
    "analysisMode": "${analysisMode}",
    "searchStrategy": "strategia utilizzata",
    "confidenceLevel": "0.0-1.0",
    "recommendedNextSteps": ["suggerimenti per analisi dettagliata"]
  }
}

IMPORTANTE: 
- Questa è solo RICERCA INDICE, non analisi completa
- Mantieni risposta VELOCE e LEGGERA
- La struttura servirà per guidare l'analisi dettagliata successiva`;

  const aiInput = createAIServiceInput(prompt, files, analysisMode, 'initial-index-search', progressCallback);
  const result = await executeAIRequest(aiInput);
  
  validateAIServiceOutput(result, ['globalStructure', 'indexAnalysis']);
  
  console.log('FASE 1 - OUTPUT GEMINI:', JSON.stringify(result.data, null, 2));
  
  return result.data;
}