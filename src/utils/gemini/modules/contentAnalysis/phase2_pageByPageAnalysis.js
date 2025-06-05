// src/utils/gemini/modules/contentAnalysis/phase2_pageByPageAnalysis.js

import { executeAIRequest, createAIServiceInput, validateAIServiceOutput } from '../../services/geminiAIService.js';
import { createPhaseError, logPhase } from '../../shared/geminiShared.js';

/**
 * FASE 2: Correzione Intelligente dei Range di Pagine
 * INPUT: examName, files, phase1Output, userDescription, analysisMode, progressCallback
 * OUTPUT: Range corretti e validati delle sezioni identificate nella Fase 1
 */
export async function performComprehensivePageByPageAnalysis(input) {
  const { examName, files, phase1Output, userDescription, analysisMode, progressCallback } = input;
  
  // Estrai le sezioni dalla Fase 1
  const mainSections = phase1Output?.globalStructure?.mainSections || [];
  
  if (mainSections.length === 0) {
    return {
      correctedSections: [],
      correctionSummary: {
        totalSections: 0,
        correctedSections: 0,
        correctionSuccess: false
      },
      analysisMetadata: {
        analysisMode: analysisMode,
        processingNotes: "Nessuna sezione da correggere dalla Fase 1"
      }
    };
  }

  logPhase('range-correction', `FASE 2: Correzione intelligente di ${mainSections.length} sezioni`);

  const sectionsInfo = mainSections.map((section, index) => 
    `${index + 1}. "${section.sectionTitle}" 
    File: ${section.fileIndex} | Range PROPOSTO: ${section.startPage}-${section.endPage} | Tipo: ${section.sectionType}
    Descrizione: ${section.description || 'Nessuna descrizione'}`
  ).join('\n\n');

  const modeNote = analysisMode === 'text' 
    ? '\n\nMODALITÀ TESTO: Correggi i range basandoti sul contenuto testuale effettivo.'
    : '\n\nMODALITÀ PDF: Correggi i range considerando anche layout e struttura visiva.';

  const prompt = `Sei un AI tutor esperto nella correzione di range di pagine per l'esame "${examName}".

COMPITO CRITICO: CORREGGI gli errori nei range di pagine identificati nella Fase 1.

SEZIONI DA CORREGGERE:
${sectionsInfo}

${userDescription ? `OBIETTIVI SPECIFICI: "${userDescription}"` : ''}${modeNote}

PROBLEMI DA RISOLVERE:
1. **PAGINE BIANCHE**: Se il range include pagine vuote, ESCLUDILE
2. **CONTENUTO SBAGLIATO**: Se il range include contenuto di altro argomento, CORREGGI
3. **RANGE IMPRECISI**: Se mancano pagine importanti o ci sono pagine di troppo, AGGIUSTA
4. **SOVRAPPOSIZIONI**: Se due sezioni si sovrappongono, DELIMITA chiaramente

STRATEGIA DI CORREZIONE:
- LEGGI attentamente il contenuto nel range proposto
- IDENTIFICA dove inizia e finisce REALMENTE l'argomento
- CORREGGI start/end page per essere PRECISI
- MANTIENI sezioni di 15-30 pagine per studio efficace
- Se una sezione è troppo lunga, SUDDIVIDI in sottosezioni logiche

JSON RICHIESTO:

{
  "correctedSections": [
    {
      "sectionIndex": 0,
      "originalTitle": "Titolo originale dalla Fase 1",
      "correctedTitle": "Titolo corretto se necessario",
      "fileIndex": 0,
      "originalRange": {"start": 10, "end": 35},
      "correctedRange": {"start": 12, "end": 32},
      "correctionType": "range_adjusted|title_refined|content_verified|split_section|merged_sections|no_changes",
      "correctionReason": "Spiegazione della correzione applicata",
      "contentQuality": "excellent|good|fair|poor",
      "studyRecommendation": "Come studiare questa sezione"
    }
  ],
  "correctionSummary": {
    "totalSections": ${mainSections.length},
    "correctedSections": 0,
    "majorCorrections": 0,
    "minorCorrections": 0,
    "correctionSuccess": true
  },
  "analysisMetadata": {
    "analysisMode": "${analysisMode}",
    "correctionStrategy": "Strategia utilizzata per le correzioni",
    "qualityAssessment": "Valutazione qualità complessiva",
    "processingNotes": "Note sul processo di correzione"
  }
}

REGOLE CRITICHE:
- OGNI sezione deve avere contenuto COERENTE e COMPLETO
- ELIMINA pagine bianche o irrilevanti dai range
- Se trovi errori grossolani, CORREGGI senza esitare
- Se una sezione copre argomenti diversi, SUDDIVIDI
- I range corretti devono essere PRECISI e UTILIZZABILI per lo studio`;

  const aiInput = createAIServiceInput(prompt, files, analysisMode, 'range-correction', progressCallback);
  const result = await executeAIRequest(aiInput);
  
  validateAIServiceOutput(result, ['correctedSections']);
  
  // Verifica che ogni sezione corretta abbia dati validi
  const correctedSections = result.data.correctedSections || [];
  const validatedSections = correctedSections.filter(section => {
    return section.correctedRange && 
           section.correctedRange.start > 0 && 
           section.correctedRange.end >= section.correctedRange.start &&
           section.fileIndex >= 0 && 
           section.fileIndex < files.length;
  });

  const finalResult = {
    ...result.data,
    correctedSections: validatedSections,
    correctionSummary: {
      ...result.data.correctionSummary,
      correctedSections: validatedSections.length,
      validationSuccess: validatedSections.length > 0
    }
  };

  logPhase('range-correction', `FASE 2 completata: ${validatedSections.length}/${mainSections.length} sezioni corrette`);
  
  console.log('FASE 2 - OUTPUT CORREZIONE:', JSON.stringify(finalResult, null, 2));
  
  return finalResult;
}