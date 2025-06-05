// src/utils/gemini/modules/contentAnalysis/phase3_topicSynthesis.js

import { executeAIRequest, createAIServiceInput, validateAIServiceOutput } from '../../services/geminiAIService.js';

/**
 * FASE 3: Analisi Specifica delle Sezioni (basata sui range della Fase 1)
 * INPUT: examName, pageAnalysisResult (output Fase 2), userDescription, progressCallback
 * OUTPUT: Analisi dettagliata di ogni sezione con difficoltà, ore e descrizione
 */
export async function performIntelligentTopicSynthesis(input) {
  const { examName, pageAnalysisResult, userDescription, progressCallback, phase1Output } = input;
  
  // Usa le sezioni dalla Fase 1 (non dalla Fase 2)
  const mainSections = phase1Output?.globalStructure?.mainSections || [];
  const validationData = pageAnalysisResult?.sectionValidation || [];
  
  if (mainSections.length === 0) {
    return { 
      synthesizedTopics: [],
      synthesisStatistics: { 
        originalSections: 0, 
        analyzedSections: 0
      }
    };
  }

  // Prepara le sezioni con i dati di validazione
  const sectionsToAnalyze = mainSections.map((section, index) => {
    const validation = validationData.find(v => v.sectionIndex === index);
    return {
      ...section,
      validationNotes: validation?.validationNotes || "Non validato",
      isValid: validation?.isValid !== false // Default true se non specificato
    };
  });

  const sectionsInfo = sectionsToAnalyze.map((section, index) => 
    `${index + 1}. "${section.sectionTitle}" (File ${section.fileIndex}, Pagine ${section.startPage}-${section.endPage}, Tipo: ${section.sectionType}, Validazione: ${section.validationNotes})`
  ).join('\n');

  const prompt = `Sei un AI tutor esperto nell'analisi didattica per l'esame "${examName}".

COMPITO: Analizza in dettaglio ogni sezione identificata, assegnando difficoltà, tempo di studio e descrizione.

SEZIONI DA ANALIZZARE (RANGE FISSI):
${sectionsInfo}

${userDescription ? `OBIETTIVI SPECIFICI: "${userDescription}"` : ''}

STRATEGIA DI ANALISI:
1. **LEGGI** attentamente il contenuto di ogni sezione nel range di pagine specificato
2. **ASSEGNA** difficoltà appropriata (beginner/intermediate/advanced)
3. **STIMA** tempo di studio realistico in ore
4. **DESCRIVI** brevemente il contenuto (2-3 righe massimo)
5. **MANTIENI** esattamente gli stessi range di pagine

JSON RICHIESTO:

{
  "synthesizedTopics": [
    {
      "title": "Titolo sezione dalla Fase 1",
      "description": "Breve descrizione del contenuto (max 3 righe)",
      "startPage": 1,
      "endPage": 25,
      "fileIndex": 0,
      "difficulty": "beginner|intermediate|advanced",
      "estimatedHours": 4,
      "sectionType": "tipo dalla Fase 1"
    }
  ],
  "synthesisStatistics": {
    "originalSections": ${mainSections.length},
    "analyzedSections": 0
  }
}

REGOLE CRITICHE:
- I range di pagine (startPage, endPage, fileIndex) devono rimanere IDENTICI alla Fase 1
- Sostituisci/migliora solo la descrizione se presente
- Tempo stimato in ore (non minuti)
- Difficoltà basata sul contenuto effettivo della sezione
- Una entry per ogni sezione della Fase 1`;

  const aiInput = createAIServiceInput(prompt, [], 'text', 'section-analysis', progressCallback);
  const result = await executeAIRequest(aiInput);
  
  validateAIServiceOutput(result, ['synthesizedTopics']);
  
  console.log('FASE 3 - OUTPUT GEMINI:', JSON.stringify(result.data, null, 2));
  
  return result.data;
}