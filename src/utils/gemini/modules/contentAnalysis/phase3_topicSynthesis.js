// src/utils/gemini/modules/contentAnalysis/phase3_topicSynthesis.js

import { executeAIRequest, createAIServiceInput, validateAIServiceOutput } from '../../services/geminiAIService.js';
import { logPhase } from '../../shared/geminiShared.js';

/**
 * FASE 3: Analisi Dettagliata con Range Corretti
 * INPUT: examName, correctionResult (da Fase 2), userDescription, progressCallback
 * OUTPUT: Analisi dettagliata di ogni sezione con range corretti
 */
export async function performIntelligentTopicSynthesis(input) {
  const { examName, pageAnalysisResult, userDescription, progressCallback } = input;
  
  // Usa le sezioni CORRETTE dalla Fase 2
  const correctedSections = pageAnalysisResult?.correctedSections || [];
  
  if (correctedSections.length === 0) {
    logPhase('topic-synthesis', 'Nessuna sezione corretta dalla Fase 2');
    return { 
      synthesizedTopics: [],
      synthesisStatistics: { 
        originalSections: 0, 
        analyzedSections: 0
      }
    };
  }

  logPhase('topic-synthesis', `FASE 3: Analisi dettagliata di ${correctedSections.length} sezioni corrette`);

  const sectionsInfo = correctedSections.map((section, index) => {
    const range = section.correctedRange || section.originalRange;
    return `${index + 1}. "${section.correctedTitle || section.originalTitle}"
    File: ${section.fileIndex} | Range CORRETTO: ${range.start}-${range.end}
    Correzione: ${section.correctionType} - ${section.correctionReason}
    Qualità contenuto: ${section.contentQuality || 'non valutata'}`;
  }).join('\n\n');

  const prompt = `Sei un AI tutor esperto nell'analisi didattica dettagliata per l'esame "${examName}".

COMPITO: Analizza in dettaglio ogni sezione con i range di pagine GIÀ CORRETTI nella Fase 2.

SEZIONI CORRETTE DA ANALIZZARE:
${sectionsInfo}

${userDescription ? `OBIETTIVI SPECIFICI: "${userDescription}"` : ''}

STRATEGIA DI ANALISI:
1. **USA** i range corretti dalla Fase 2 (NON modificarli)
2. **ANALIZZA** il contenuto specifico in quei range precisi
3. **ASSEGNA** difficoltà basata sul contenuto reale
4. **STIMA** tempo di studio realistico
5. **DESCRIVI** il contenuto effettivo trovato

JSON RICHIESTO:

{
  "synthesizedTopics": [
    {
      "title": "Titolo dalla Fase 2 (corrected o original)",
      "description": "Descrizione dettagliata del contenuto REALE trovato",
      "startPage": 12,
      "endPage": 32,
      "fileIndex": 0,
      "difficulty": "beginner|intermediate|advanced",
      "estimatedHours": 4,
      "contentType": "theory|exercises|mixed|formulas|examples",
      "keyTopics": ["topic1", "topic2", "topic3"],
      "studyNotes": "Note specifiche per lo studio di questa sezione",
      "contentVerified": true
    }
  ],
  "synthesisStatistics": {
    "originalSections": ${correctedSections.length},
    "analyzedSections": 0,
    "totalPages": 0,
    "avgDifficulty": "intermediate",
    "totalEstimatedHours": 0
  },
  "qualityReport": {
    "contentCoherence": "high|medium|low",
    "studyEfficiency": "optimized|good|needs_improvement",
    "overallAssessment": "Valutazione generale delle sezioni corrette"
  }
}

REGOLE CRITICHE:
- USA ESATTAMENTE i range corretti dalla Fase 2
- NON modificare startPage/endPage - sono già stati corretti
- ANALIZZA solo il contenuto nei range specificati
- VERIFICA che il contenuto sia coerente con il titolo
- Se trovi discrepanze, SEGNALA in "description" ma MANTIENI i range`;

  const aiInput = createAIServiceInput(prompt, [], 'text', 'detailed-section-analysis', progressCallback);
  const result = await executeAIRequest(aiInput);
  
  validateAIServiceOutput(result, ['synthesizedTopics']);
  
  // Assicurati che i topic mantengano i range corretti
  const synthesizedTopics = result.data.synthesizedTopics || [];
  const verifiedTopics = synthesizedTopics.map((topic, index) => {
    const originalSection = correctedSections[index];
    if (originalSection) {
      const correctedRange = originalSection.correctedRange || originalSection.originalRange;
      return {
        ...topic,
        startPage: correctedRange.start,
        endPage: correctedRange.end,
        fileIndex: originalSection.fileIndex,
        title: topic.title || originalSection.correctedTitle || originalSection.originalTitle
      };
    }
    return topic;
  });

  const finalResult = {
    ...result.data,
    synthesizedTopics: verifiedTopics,
    synthesisStatistics: {
      ...result.data.synthesisStatistics,
      analyzedSections: verifiedTopics.length
    }
  };

  logPhase('topic-synthesis', `FASE 3 completata: ${verifiedTopics.length} argomenti analizzati con range corretti`);
  
  console.log('FASE 3 - OUTPUT SYNTHESIS:', JSON.stringify(finalResult, null, 2));
  
  return finalResult;
}