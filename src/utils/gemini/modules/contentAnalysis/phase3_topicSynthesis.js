// src/utils/gemini/modules/contentAnalysis/phase3_topicSynthesis.js

import { executeAIRequest, createAIServiceInput, validateAIServiceOutput } from '../../services/geminiAIService.js';
import { logPhase } from '../../shared/geminiShared.js';

/**
 * FASE 3: Sintesi Intelligente degli Argomenti (basata su analisi completa)
 * INPUT: examName, pageAnalysisResult (output Fase 2), userDescription
 * OUTPUT: Argomenti sintetizzati basati su analisi reale delle pagine
 */
export async function performIntelligentTopicSynthesis(input) {
  const { examName, pageAnalysisResult, userDescription, progressCallback } = input;
  
  logPhase('intelligent-topic-synthesis', `FASE 3: Sintesi da ${pageAnalysisResult.pageByPageAnalysis?.length || 0} pagine analizzate`);
  
  const pageAnalysisData = pageAnalysisResult.pageByPageAnalysis || [];
  const globalStructure = pageAnalysisResult.globalStructure || {};
  
  if (pageAnalysisData.length === 0) {
    // Potrebbe essere valido se non ci sono pagine, ma lancia un warning se ci si aspettava qualcosa.
    logPhase('intelligent-topic-synthesis', 'Nessuna analisi pagina-per-pagina disponibile per la sintesi. Procedo con output vuoto.');
    return { 
      synthesizedTopics: [],
      synthesisStatistics: { originalPages: 0, synthesizedTopics: 0, totalPagesAssigned: 0, averagePagesPerTopic: 0, coveragePercentage: "0.0", synthesisStrategy: "Nessuna pagina da sintetizzare" },
      qualityMetrics: { coverage: "0%", coherence: "N/A", balance: "N/A", overallQuality: "0.0" },
      synthesisMetadata: { basedOnPages: 0, processingNotes: "Nessuna pagina analizzata fornita.", qualityAssurance: "N/A" }
    };
  }

  const analysisDataJson = JSON.stringify({
    globalStructure: globalStructure,
    pageAnalysis: pageAnalysisData.slice(0, 200), // Limita per dimensione prompt se necessario
    contentSummary: pageAnalysisResult.contentSummary
  }, null, 2);

  const prompt = `SINTESI INTELLIGENTE ARGOMENTI per l'esame "${examName}":

DATI ANALISI COMPLETA DELLE PAGINE:
${analysisDataJson}

${userDescription ? `OBIETTIVI UTENTE: "${userDescription}"` : ''}

COMPITO: Sintetizza l'analisi pagina-per-pagina in argomenti di studio coerenti e logici.

PRINCIPI DI SINTESI INTELLIGENTE:
1. **RAGGRUPPA** pagine correlate che appartengono allo stesso macro-argomento
2. **MANTIENI** granularità appropriata (né troppo generici né troppo specifici)
3. **RISPETTA** le transizioni naturali identificate nell'analisi
4. **PRESERVA** i riferimenti esatti alle pagine dall'analisi
5. **ORDINA** secondo sequenza logica di apprendimento
6. **BILANCIA** il carico di studio per argomento

REGOLE INTELLIGENTI:
- Se un concetto appare in più pagine consecutive, crea UN argomento che le include
- Se una pagina contiene concetti molto diversi, considera di suddividerla
- Mantieni argomenti tra 5-30 pagine quando possibile
- Priorità alle pagine con importance="high"
- Considera la difficulty per la sequenza di studio
- Collega prerequisiti identificati nell'analisi

FORMATO DETTAGLIATO:
{
  "synthesizedTopics": [
    {
      "id": "topic_001",
      "title": "Titolo argomento sintetizzato basato su analisi reale",
      "description": "Descrizione completa che spiega cosa copre questo argomento",
      "pages_info": [
        {
          "pdf_index": 0,
          "original_filename": "filename.pdf",
          "start_page": 5,
          "end_page": 18,
          "content_notes": "Note specifiche su cosa si trova in queste pagine dall'analisi"
        }
      ],
      "totalPages": 14,
      "priority": "high|medium|low",
      "difficulty": "beginner|intermediate|advanced",
      "estimatedHours": 4,
      "learningObjectives": [
        "Obiettivo apprendimento basato su analisi reale 1",
        "Obiettivo apprendimento basato su analisi reale 2"
      ],
      "keyConcepts": ["concetto estratto dall'analisi", "concetto2", "concetto3"],
      "hasExercises": true,
      "hasFormulas": false,
      "studyTips": "Suggerimenti basati su analisi reale delle pagine",
      "prerequisites": ["prerequisiti identificati dall'analisi"],
      "synthesisNotes": "Note su come questo argomento è stato creato dall'analisi",
      "qualityScore": "0.0-1.0",
      "sourcePages": [
        {
          "fileIndex": 0,
          "pageNumber": 5,
          "mainTopicsFromAnalysis": ["topic dal pageByPageAnalysis"],
          "contentType": "theory|examples|exercises",
          "importance": "high|medium|low"
        }
      ]
    }
  ],
  "synthesisStatistics": {
    "originalPages": ${pageAnalysisData.length},
    "synthesizedTopics": 0,
    "totalPagesAssigned": 0,
    "averagePagesPerTopic": 0,
    "coveragePercentage": "0.0-1.0",
    "synthesisStrategy": "Strategia utilizzata per la sintesi"
  },
  "qualityMetrics": {
    "coverage": "percentuale di contenuto coperto dalla sintesi",
    "coherence": "coerenza degli argomenti sintetizzati",
    "balance": "bilanciamento del carico di studio",
    "overallQuality": "0.0-1.0"
  },
  "synthesisMetadata": {
    "basedOnPages": ${pageAnalysisData.length},
    "processingNotes": "Note sul processo di sintesi",
    "qualityAssurance": "Controlli di qualità applicati"
  }
}

IMPORTANTE: 
- Ogni pagina deve apparire in MASSIMO un argomento
- Non lasciare "buchi" nel materiale
- Mantieni il collegamento preciso con l'analisi pagina-per-pagina
- Ogni argomento deve avere un valore educativo chiaro
- I numeri di pagina devono corrispondere ESATTAMENTE all'analisi iniziale`;

  const aiInput = createAIServiceInput(prompt, [], 'text', 'intelligent-topic-synthesis', progressCallback);
  const result = await executeAIRequest(aiInput);
  
  validateAIServiceOutput(result, ['synthesizedTopics']);
  
  let synthesisData = result.data;
  
  // Applica miglioramenti di qualità se ci sono topic
  if (synthesisData.synthesizedTopics && synthesisData.synthesizedTopics.length > 0) {
     synthesisData = enhanceSynthesisQuality(synthesisData, pageAnalysisResult);
  }

  const synthesizedTopicsCount = synthesisData.synthesizedTopics?.length || 0;
  logPhase('intelligent-topic-synthesis', `FASE 3 completata: ${synthesizedTopicsCount} argomenti finali`);
  
  return synthesisData;
}

/**
 * Migliora la qualità del risultato della sintesi
 */
function enhanceSynthesisQuality(synthesisResult, pageAnalysisResult) {
  logPhase('quality-enhancement', 'Miglioramento qualità sintesi...');
  
  const enhancedTopics = synthesisResult.synthesizedTopics.map(topic => {
    const topicStats = calculateTopicStatisticsFromAnalysis(topic, pageAnalysisResult);
    return {
      ...topic,
      enhancedMetrics: topicStats,
      qualityScore: calculateEnhancedQualityScore(topic, topicStats, topic.totalPages), // Pass totalPages
      studyRecommendations: generateStudyRecommendations(topic, topicStats)
    };
  });
  
  const averageQualityScore = enhancedTopics.length > 0 
    ? enhancedTopics.reduce((sum, t) => sum + (t.qualityScore || 0), 0) / enhancedTopics.length
    : 0;

  return {
    ...synthesisResult,
    synthesizedTopics: enhancedTopics,
    qualityEnhancement: {
      applied: true,
      enhancedTopics: enhancedTopics.length,
      averageQualityScore: averageQualityScore
    }
  };
}

/**
 * Calcola statistiche del topic dall'analisi completa
 */
function calculateTopicStatisticsFromAnalysis(topic, pageAnalysisResult) {
  const pageAnalysisMap = new Map();
  if(pageAnalysisResult.pageByPageAnalysis) {
    pageAnalysisResult.pageByPageAnalysis.forEach(page => {
        const key = `${page.fileIndex}-${page.pageNumber}`;
        pageAnalysisMap.set(key, page);
    });
  }
  
  let totalStudyTime = 0;
  let conceptDensityScores = [];
  let importanceScores = [];
  let difficultyScores = [];
  
  topic.pages_info?.forEach(pInfo => {
    for (let pageNum = pInfo.start_page; pageNum <= pInfo.end_page; pageNum++) {
      const analysisKey = `${pInfo.pdf_index}-${pageNum}`;
      const pageAnalysis = pageAnalysisMap.get(analysisKey);
      
      if (pageAnalysis) {
        if (pageAnalysis.estimatedStudyTime) totalStudyTime += pageAnalysis.estimatedStudyTime;
        if (pageAnalysis.conceptDensity) conceptDensityScores.push(pageAnalysis.conceptDensity);
        if (pageAnalysis.importance) importanceScores.push(pageAnalysis.importance);
        if (pageAnalysis.difficulty) difficultyScores.push(pageAnalysis.difficulty);
      }
    }
  });
  
  return {
    totalStudyTimeFromAnalysis: totalStudyTime,
    averageConceptDensity: calculateAverageConceptDensity(conceptDensityScores),
    averageImportance: calculateAverageImportance(importanceScores),
    difficultyDistribution: calculateDifficultyDistribution(difficultyScores),
    analysisBasedEstimation: true
  };
}

function calculateAverageConceptDensity(densityScores) {
  if (!densityScores || densityScores.length === 0) return 'medium';
  const densityValues = { low: 1, medium: 2, high: 3 };
  const avgScore = densityScores.reduce((sum, density) => sum + (densityValues[density] || 2), 0) / densityScores.length;
  if (avgScore <= 1.3) return 'low';
  if (avgScore >= 2.7) return 'high';
  return 'medium';
}

function calculateAverageImportance(importanceScores) {
  if (!importanceScores || importanceScores.length === 0) return 'medium';
  const importanceValues = { low: 1, medium: 2, high: 3 };
  const avgScore = importanceScores.reduce((sum, importance) => sum + (importanceValues[importance] || 2), 0) / importanceScores.length;
  if (avgScore <= 1.3) return 'low';
  if (avgScore >= 2.7) return 'high';
  return 'medium';
}

function calculateDifficultyDistribution(difficultyScores) {
  const distribution = { beginner: 0, intermediate: 0, advanced: 0 };
  if(difficultyScores) {
    difficultyScores.forEach(difficulty => {
        if (distribution.hasOwnProperty(difficulty)) {
        distribution[difficulty]++;
        }
    });
  }
  return distribution;
}

/**
 * Calcola quality score migliorato (simile a calculateTopicQualityScore originale)
 */
function calculateEnhancedQualityScore(topic, topicStats, totalPages) {
  let score = 0.5; // Base score
  if (topic.description && topic.description.length > 50) score += 0.1;
  if (topic.keyConcepts && topic.keyConcepts.length > 3) score += 0.1;
  if (topic.learningObjectives && topic.learningObjectives.length > 0) score += 0.1;
  if (totalPages >= 8 && totalPages <= 25) score += 0.2; 
  if (topic.priority === 'high') score += 0.1;
  
  // Bonus basati su statistiche dall'analisi
  if (topicStats.averageImportance === 'high') score += 0.1;
  if (topicStats.averageConceptDensity === 'high') score += 0.05;
  if (topicStats.analysisBasedEstimation) score += 0.05;
  
  return Math.min(1.0, parseFloat(score.toFixed(2)));
}


function generateStudyRecommendations(topic, topicStats) {
  const recommendations = [];
  if (topicStats.averageConceptDensity === 'high') {
    recommendations.push('Alta densità concettuale: studia in sessioni brevi con pause frequenti');
  }
  if (topicStats.averageImportance === 'high') {
    recommendations.push('Argomento ad alta importanza: dedica tempo extra e ripassa più volte');
  }
  if (topicStats.totalStudyTimeFromAnalysis > 120) { 
    recommendations.push('Argomento lungo: suddividi in sessioni multiple');
  }
  const difficultyDistrib = topicStats.difficultyDistribution;
  if (difficultyDistrib.advanced > (difficultyDistrib.beginner || 0) + (difficultyDistrib.intermediate || 0) ) {
    recommendations.push('Prevalentemente avanzato: assicurati di avere solide basi prima di affrontarlo');
  }
  if (recommendations.length === 0) {
    recommendations.push('Approccio standard: studio costante con revisioni regolari');
  }
  return recommendations;
}