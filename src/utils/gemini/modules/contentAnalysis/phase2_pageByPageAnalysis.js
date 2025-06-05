// src/utils/gemini/modules/contentAnalysis/phase2_pageByPageAnalysis.js

import { executeAIRequest, createAIServiceInput, validateAIServiceOutput } from '../../services/geminiAIService.js';
import { createPhaseError } from '../../shared/geminiShared.js';

/**
 * FASE 2: Verifica e Validazione Sezioni (SEMPLIFICATA)
 * INPUT: examName, files, phase1Output, userDescription, analysisMode, progressCallback
 * OUTPUT: Validazione della divisione delle sezioni identificate nella Fase 1
 */
export async function performComprehensivePageByPageAnalysis(input) {
  const { examName, files, phase1Output, userDescription, analysisMode, progressCallback } = input;
  
  // Estrai le sezioni dalla Fase 1
  const mainSections = phase1Output?.globalStructure?.mainSections || [];
  
  if (mainSections.length === 0) {
    return {
      sectionValidation: [],
      validationSummary: {
        totalSections: 0,
        validSections: 0,
        validationSuccess: false
      },
      analysisMetadata: {
        analysisMode: analysisMode,
        processingNotes: "Nessuna sezione da validare dalla Fase 1"
      }
    };
  }

  const sectionsInfo = mainSections.map((section, index) => 
    `${index + 1}. "${section.sectionTitle}" (File ${section.fileIndex}, Pagine ${section.startPage}-${section.endPage}, Tipo: ${section.sectionType})`
  ).join('\n');

  const modeNote = analysisMode === 'text' 
    ? '\n\nMODALITÀ TESTO: Verifica la coerenza delle sezioni nel contenuto testuale.'
    : '\n\nMODALITÀ PDF: Verifica la coerenza delle sezioni includendo layout e struttura visiva.';

  const prompt = `Sei un AI tutor esperto nella validazione di strutture didattiche per l'esame "${examName}".

COMPITO: VALIDA SOLO la coerenza e correttezza delle sezioni identificate nella Fase 1.

SEZIONI DA VALIDARE:
${sectionsInfo}

${userDescription ? `OBIETTIVI SPECIFICI: "${userDescription}"` : ''}${modeNote}

STRATEGIA DI VALIDAZIONE:
1. **VERIFICA** che ogni sezione corrisponda effettivamente al contenuto nelle pagine indicate
2. **CONFERMA** la coerenza dei titoli delle sezioni
3. **VALIDA** i range di pagine specificati
4. **NON MODIFICARE** i range di pagine - solo confermare se sono corretti

JSON RICHIESTO - FORMATO SEMPLIFICATO:

{
  "sectionValidation": [
    {
      "sectionIndex": 0,
      "sectionTitle": "Titolo esatto dalla Fase 1",
      "fileIndex": 0,
      "startPage": 1,
      "endPage": 25,
      "isValid": true,
      "validationNotes": "Breve nota sulla validazione (max 50 caratteri)"
    }
  ],
  "validationSummary": {
    "totalSections": ${mainSections.length},
    "validSections": 0,
    "validationSuccess": true
  },
  "analysisMetadata": {
    "analysisMode": "${analysisMode}",
    "processingNotes": "Note sul processo di validazione"
  }
}

IMPORTANTE:
- MANTIENI IDENTICI tutti i range di pagine dalla Fase 1
- VALIDAZIONE SOLO - non analisi dettagliata
- Una entry per ogni sezione identificata nella Fase 1
- Conferma solo se le sezioni sono coerenti con il contenuto`;

  const aiInput = createAIServiceInput(prompt, files, analysisMode, 'section-validation', progressCallback);
  const result = await executeAIRequest(aiInput);
  
  validateAIServiceOutput(result, ['sectionValidation']);
  
  console.log('FASE 2 - OUTPUT GEMINI:', JSON.stringify(result.data, null, 2));
  
  return result.data;
}