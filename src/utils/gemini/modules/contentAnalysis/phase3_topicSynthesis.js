// src/utils/gemini/modules/contentAnalysis/phase3_topicSynthesis.js

import { executeAIRequest, createAIServiceInput, validateAIServiceOutput } from '../../services/geminiAIService.js';

/**
 * FASE 3: Sintesi Intelligente degli Argomenti (basata su analisi completa)
 * INPUT: examName, pageAnalysisResult (output Fase 2), userDescription
 * OUTPUT: Argomenti sintetizzati in formato semplificato
 */
export async function performIntelligentTopicSynthesis(input) {
  const { examName, pageAnalysisResult, userDescription, progressCallback } = input;
  
  const pageAnalysisData = pageAnalysisResult.pageByPageAnalysis || [];
  
  if (pageAnalysisData.length === 0) {
    return { 
      synthesizedTopics: [],
      synthesisStatistics: { 
        originalPages: 0, 
        synthesizedTopics: 0, 
        totalPagesAssigned: 0
      }
    };
  }

  const analysisDataJson = JSON.stringify({
    pageAnalysis: pageAnalysisData
  }, null, 2);

  const prompt = `SINTESI INTELLIGENTE ARGOMENTI per l'esame "${examName}":

DATI ANALISI PAGINE:
${analysisDataJson}

${userDescription ? `OBIETTIVI UTENTE: "${userDescription}"` : ''}

COMPITO: Sintetizza l'analisi pagina-per-pagina in argomenti di studio coerenti e logici.

PRINCIPI DI SINTESI:
1. **RAGGRUPPA** pagine correlate che appartengono allo stesso macro-argomento
2. **MANTIENI** granularità appropriata (né troppo generici né troppo specifici)
3. **PRESERVA** i riferimenti esatti alle pagine dall'analisi
4. **ORDINA** secondo sequenza logica di apprendimento

FORMATO SEMPLIFICATO:
{
  "synthesizedTopics": [
    {
      "title": "Titolo del paragrafo/argomento",
      "startPage": 5,
      "endPage": 18,
      "fileIndex": 0,
      "difficulty": "beginner|intermediate|advanced",
      "estimatedHours": 4
    }
  ],
  "synthesisStatistics": {
    "originalPages": ${pageAnalysisData.length},
    "synthesizedTopics": 0,
    "totalPagesAssigned": 0
  }
}

IMPORTANTE: 
- Ogni pagina deve apparire in MASSIMO un argomento
- Titolo chiaro e descrittivo del paragrafo
- Range di pagine continuo (da startPage a endPage)
- Stima realistica delle ore di studio per l'intero paragrafo
- Difficoltà basata sulla media delle pagine incluse`;

  const aiInput = createAIServiceInput(prompt, [], 'text', 'intelligent-topic-synthesis', progressCallback);
  const result = await executeAIRequest(aiInput);
  
  validateAIServiceOutput(result, ['synthesizedTopics']);
  
  console.log('FASE 3 - OUTPUT GEMINI:', JSON.stringify(result.data, null, 2));
  
  return result.data;
}