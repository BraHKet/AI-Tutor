// src/utils/gemini/modules/contentAnalysis/phase2_pageByPageAnalysis.js

import { executeAIRequest, createAIServiceInput, validateAIServiceOutput } from '../../services/geminiAIService.js';
import { createPhaseError } from '../../shared/geminiShared.js';

/**
 * FASE 2: Analisi Dettagliata Completa Pagina per Pagina (PESANTE)
 * INPUT: examName, files, phase1Output, userDescription, analysisMode, progressCallback
 * OUTPUT: Analisi semplificata di ogni singola pagina
 */
export async function performComprehensivePageByPageAnalysis(input) {
  const { examName, files, phase1Output, userDescription, analysisMode, progressCallback } = input;
  
  // Prepara contesto dalla Fase 1
  const contextFromPhase1 = preparePhase1Context(phase1Output);
  
  const filesList = files
    .map((file, index) => `${index + 1}. ${file.name} (${Math.round(file.size / 1024 / 1024)} MB)`)
    .join('\n');

  const modeNote = analysisMode === 'text' 
    ? '\n\nMODALITÀ TESTO: Analizza il contenuto testuale di ogni pagina in dettaglio.'
    : '\n\nMODALITÀ PDF: Analizza ogni pagina includendo elementi visivi, layout, formule e grafici.';

  const prompt = `Sei un AI tutor esperto nell'analisi dettagliata pagina per pagina di materiale didattico per l'esame "${examName}".

COMPITO: Analizza DETTAGLIATAMENTE OGNI SINGOLA PAGINA del materiale.

FILE DA ANALIZZARE:
${filesList}

CONTESTO DALLA FASE 1 (Struttura e Indice):
${contextFromPhase1}

${userDescription ? `OBIETTIVI SPECIFICI: "${userDescription}"` : ''}${modeNote}

STRATEGIA ANALISI COMPLETA:
1. **ANALIZZA OGNI PAGINA SINGOLARMENTE** - Non saltare nessuna pagina
2. **IDENTIFICA CONTENUTO SPECIFICO** - Una riga di descrizione per ogni pagina
3. **VALUTA DIFFICOLTÀ** - Livello di complessità di ogni pagina
4. **STIMA TEMPO STUDIO IN MINUTI** - Tempo necessario per studiare ogni pagina

JSON RICHIESTO - FORMATO SEMPLIFICATO:

{
  "pageByPageAnalysis": [
    {
      "fileIndex": 0,
      "pageNumber": 1,
      "description": "Breve descrizione del contenuto della pagina (max 100 caratteri)",
      "difficulty": "beginner|intermediate|advanced",
      "estimatedStudyTime": 30
    }
  ],
  "analysisMetadata": {
    "analysisMode": "${analysisMode}",
    "totalPagesAnalyzed": 0,
    "processingNotes": "Note sul processo di analisi"
  }
}

IMPORTANTE:
- UNA ENTRY per OGNI pagina di OGNI file
- Descrizione breve e specifica del contenuto
- Stima realistica del tempo di studio in minuti
- Mantieni coerenza con la struttura identificata nella Fase 1`;

  const aiInput = createAIServiceInput(prompt, files, analysisMode, 'comprehensive-page-analysis', progressCallback);
  const result = await executeAIRequest(aiInput);
  
  validateAIServiceOutput(result, ['pageByPageAnalysis']);
  
  console.log('FASE 2 - OUTPUT GEMINI:', JSON.stringify(result.data, null, 2));
  
  return result.data;
}

/**
 * Prepara il contesto dalla Fase 1 per l'analisi della Fase 2
 */
function preparePhase1Context(phase1Output) {
  if (!phase1Output) return 'Nessun contesto dalla Fase 1 disponibile.';
  
  const globalStructure = phase1Output.globalStructure || {};
  const sections = globalStructure.mainSections || [];
  const indexAnalysis = phase1Output.indexAnalysis || {};
  
  let context = `STRUTTURA GLOBALE IDENTIFICATA:
- Tipo materiale: ${globalStructure.materialType || 'non specificato'}
- Organizzazione: ${globalStructure.overallOrganization || 'non specificata'}
- Ha indice principale: ${globalStructure.hasMainIndex ? 'Sì' : 'No'}

SEZIONI PRINCIPALI IDENTIFICATE:`;
  
  sections.forEach((section, index) => {
    context += `\n${index + 1}. ${section.sectionTitle} (${section.sectionType})`;
    context += `\n   - File ${section.fileIndex}, Pagine ${section.startPage}-${section.endPage}`;
    context += `\n   - Importanza: ${section.importance}`;
  });
  
  if (indexAnalysis.indexFound) {
    context += `\n\nINDICE IDENTIFICATO:
- Qualità: ${indexAnalysis.indexQuality}
- Voci totali: ${indexAnalysis.totalEntries || 0}
- Utilità: ${indexAnalysis.indexUtility}`;
  }
  
  return context;
}