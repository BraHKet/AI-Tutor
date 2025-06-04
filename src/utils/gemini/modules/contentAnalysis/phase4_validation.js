// src/utils/gemini/modules/contentAnalysis/phase4_validation.js

import { logPhase } from '../../shared/geminiShared.js';

// Tutte le funzioni di supporto per la validazione e ottimizzazione verranno qui.
// (performDeepValidationWithPageAnalysis, enrichTopicWithAnalysis, ecc.)


/**
 * FASE 4: Validazione e Ottimizzazione Finale
 * INPUT: synthesisResult (da Fase 3), files, initialComprehensiveAnalysisResult (da Fase 1/2)
 * OUTPUT: Argomenti validati, ottimizzati e corretti
 */
export async function performFinalValidationAndOptimization(input) {
  const { synthesisResult, files, initialComprehensiveAnalysisResult, examName, progressCallback } = input;
  
  logPhase('final-validation', `FASE 4: Validazione finale ${synthesisResult.synthesizedTopics?.length || 0} argomenti`);
  
  const topics = synthesisResult.synthesizedTopics || [];
  const originalPageAnalysis = initialComprehensiveAnalysisResult.pageByPageAnalysis || [];
  
  if (topics.length === 0) {
    logPhase('final-validation', 'Nessun argomento da validare. Fase saltata.');
     return {
        validatedTopics: [],
        statistics: calculateComprehensiveStatisticsWithAnalysis([], originalPageAnalysis),
        validationReport: {
            originalCount: 0,
            validatedCount: 0,
            optimizationsApplied: false,
            qualityScore: 0,
            pageAnalysisIntegration: originalPageAnalysis.length > 0
        },
        originalSynthesis: synthesisResult,
        pageAnalysisBase: {
            totalPagesAnalyzed: originalPageAnalysis.length,
            analysisQuality: calculateAnalysisQuality(originalPageAnalysis)
        }
    };
  }

  progressCallback?.({ type: 'processing', message: `Fase 4: Validazione approfondita...` });
  const validatedTopics = await performDeepValidationWithPageAnalysis(topics, files, originalPageAnalysis);
  
  progressCallback?.({ type: 'processing', message: `Fase 4: Ottimizzazione intelligente...` });
  const optimizedTopics = await performIntelligentOptimizationWithContext(validatedTopics, files, originalPageAnalysis);
  
  const finalStats = calculateComprehensiveStatisticsWithAnalysis(optimizedTopics, originalPageAnalysis);
  
  logPhase('final-validation', `FASE 4 completata: ${optimizedTopics.length} argomenti finali ottimizzati`);
  
  return {
    validatedTopics: optimizedTopics,
    statistics: finalStats,
    validationReport: {
      originalCount: topics.length,
      validatedCount: optimizedTopics.length,
      optimizationsApplied: optimizedTopics.length !== topics.length, // Semplice controllo, può essere migliorato
      qualityScore: calculateOverallQualityScore(optimizedTopics), // Rinominato da calculateQualityScore
      pageAnalysisIntegration: true
    },
    originalSynthesis: synthesisResult,
    pageAnalysisBase: {
      totalPagesAnalyzed: originalPageAnalysis.length,
      analysisQuality: calculateAnalysisQuality(originalPageAnalysis)
    }
  };
}

// ===== FUNZIONI DI SUPPORTO AVANZATE (COPIATE E ADATTATE) =====

async function performDeepValidationWithPageAnalysis(topics, files, pageAnalysis) {
  logPhase('deep-validation', `Validazione con analisi di ${pageAnalysis.length} pagine...`);
  const validatedTopics = [];
  const pageAssignments = new Map(); 
  const pageAnalysisMap = new Map();
  pageAnalysis.forEach(page => {
    const key = `${page.fileIndex}-${page.pageNumber}`;
    pageAnalysisMap.set(key, page);
  });
  
  for (const topic of topics) {
    if (!topic.title || !topic.pages_info || topic.pages_info.length === 0) {
      logPhase('deep-validation', `Scartato "${topic.title}" (mancanza titolo/pagine)`);
      continue;
    }
    
    const validPagesInfo = [];
    let totalValidPages = 0;
    
    for (const pInfo of topic.pages_info) {
      const fileIndex = pInfo.pdf_index;
      if (fileIndex < 0 || fileIndex >= files.length) {
        logPhase('deep-validation', `Pagine ignorate per "${topic.title}" - file index ${fileIndex} non valido`);
        continue;
      }
      
      const startPage = Math.max(1, pInfo.start_page || 1); // Default a 1 se mancante
      const endPage = Math.max(startPage, pInfo.end_page || startPage); // Default a startPage se mancante
      
      let validatedPageRange = { start: startPage, end: endPage };
      let analysisConfirmed = false;
      for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
        if (pageAnalysisMap.has(`${fileIndex}-${pageNum}`)) {
          analysisConfirmed = true;
          break;
        }
      }
      
      if (!analysisConfirmed && pageAnalysis.length > 0) { // Tenta correzione solo se c'è un'analisi
        logPhase('deep-validation', `Range ${startPage}-${endPage} per "${topic.title}" non trovato nell'analisi - tentativo correzione`);
        validatedPageRange = findNearestAnalyzedPages(fileIndex, startPage, endPage, pageAnalysisMap);
      }
      
      const filePageMap = pageAssignments.get(fileIndex) || new Set();
      let hasOverlap = false;
      for (let pageNum = validatedPageRange.start; pageNum <= validatedPageRange.end; pageNum++) {
        if (filePageMap.has(pageNum)) {
          hasOverlap = true;
          break;
        }
      }
      
      if (!hasOverlap) {
        for (let pageNum = validatedPageRange.start; pageNum <= validatedPageRange.end; pageNum++) {
          filePageMap.add(pageNum);
        }
        pageAssignments.set(fileIndex, filePageMap);
        
        const enrichedPagesInfo = enrichPagesInfoWithAnalysis(
          validatedPageRange, 
          fileIndex, 
          files[fileIndex].name, 
          pageAnalysisMap
        );
        
        validPagesInfo.push(enrichedPagesInfo);
        totalValidPages += (validatedPageRange.end - validatedPageRange.start + 1);
      } else {
        logPhase('deep-validation', `Sovrapposizione detectata per "${topic.title}" pagine ${validatedPageRange.start}-${validatedPageRange.end}, file ${fileIndex}`);
      }
    }
    
    const MIN_PAGES_FOR_VALID_TOPIC = 1; // Abbassato da 3 per maggiore flessibilità
    if (validPagesInfo.length > 0 && totalValidPages >= MIN_PAGES_FOR_VALID_TOPIC) {
      const enrichedTopic = enrichTopicWithAnalysis(topic, validPagesInfo, pageAnalysisMap);
      validatedTopics.push({
        ...enrichedTopic,
        pages_info: validPagesInfo,
        totalPages: totalValidPages,
        validation: {
          originalPagesInfoCount: topic.pages_info.length,
          validPagesInfoCount: validPagesInfo.length,
          totalValidPages: totalValidPages,
          qualityScore: calculateTopicQualityScore(enrichedTopic, totalValidPages),
          analysisIntegration: pageAnalysis.length > 0
        }
      });
    } else {
      logPhase('deep-validation', `Scartato "${topic.title}" (pagine insufficienti/non valide dopo validazione: ${totalValidPages})`);
    }
  }
  logPhase('deep-validation', `Validazione completata: ${validatedTopics.length}/${topics.length} argomenti validi`);
  return validatedTopics;
}

function findNearestAnalyzedPages(fileIndex, startPage, endPage, pageAnalysisMap) {
  let nearestStart = -1, nearestEnd = -1;
  const MAX_OFFSET = 5;

  for (let offset = 0; offset <= MAX_OFFSET; offset++) {
    const checkUpS = startPage - offset;
    const checkDownS = startPage + offset;
    if (checkUpS > 0 && pageAnalysisMap.has(`${fileIndex}-${checkUpS}`)) { nearestStart = checkUpS; break; }
    if (pageAnalysisMap.has(`${fileIndex}-${checkDownS}`)) { nearestStart = checkDownS; break; }
  }
    if (nearestStart === -1 && startPage > 0) nearestStart = startPage; // fallback a pagina originale se non trova nulla
    else if (nearestStart === -1) nearestStart = 1; // fallback estremo


  for (let offset = 0; offset <= MAX_OFFSET; offset++) {
    const checkUpE = endPage + offset; // Cerca prima in avanti per endPage
    const checkDownE = endPage - offset;
    if (pageAnalysisMap.has(`${fileIndex}-${checkUpE}`)) { nearestEnd = checkUpE; break;}
    if (checkDownE > 0 && pageAnalysisMap.has(`${fileIndex}-${checkDownE}`)) { nearestEnd = checkDownE; break; }
  }
    if (nearestEnd === -1) nearestEnd = endPage; // fallback

  return { start: nearestStart, end: Math.max(nearestStart, nearestEnd) };
}

function enrichPagesInfoWithAnalysis(pageRange, fileIndex, fileName, pageAnalysisMap) {
  const enrichedInfo = {
    pdf_index: fileIndex,
    original_filename: fileName,
    start_page: pageRange.start,
    end_page: pageRange.end,
    content_notes: "Note specifiche su cosa si trova in queste pagine (generate da validazione)"
  };
  const pageContentSummary = [], difficulties = [], contentTypes = [];
  let hasFormulas = false, hasExercises = false;

  for (let pageNum = pageRange.start; pageNum <= pageRange.end; pageNum++) {
    const pageData = pageAnalysisMap.get(`${fileIndex}-${pageNum}`);
    if (pageData) {
      if (pageData.pageTitle) pageContentSummary.push(`P.${pageNum}: ${pageData.pageTitle}`);
      if (pageData.difficulty) difficulties.push(pageData.difficulty);
      if (pageData.contentType) contentTypes.push(pageData.contentType);
      if (pageData.hasFormulas) hasFormulas = true;
      if (pageData.hasExercises) hasExercises = true;
    }
  }
  if (pageContentSummary.length > 0) enrichedInfo.content_notes = pageContentSummary.slice(0, 3).join('; ');
  
  enrichedInfo.analysisMetadata = {
    averageDifficulty: calculateAverageDifficulty(difficulties),
    primaryContentType: findMostCommon(contentTypes),
    hasFormulas: hasFormulas,
    hasExercises: hasExercises,
    analysisConfidence: difficulties.length / Math.max(1, (pageRange.end - pageRange.start + 1))
  };
  return enrichedInfo;
}

function enrichTopicWithAnalysis(topic, validPagesInfo, pageAnalysisMap) {
  const enrichedTopic = { ...topic };
  const allKeyConcepts = new Set(topic.keyConcepts || []);
  const allKeyTerms = new Set();
  const allPrerequisites = new Set(topic.prerequisites || []);
  let totalStudyTime = 0;
  let hasFormulasInAnalysis = false, hasExercisesInAnalysis = false;

  validPagesInfo.forEach(pInfo => {
    for (let pageNum = pInfo.start_page; pageNum <= pInfo.end_page; pageNum++) {
      const pageData = pageAnalysisMap.get(`${pInfo.pdf_index}-${pageNum}`);
      if (pageData) {
        pageData.mainTopics?.forEach(mt => mt.keyPoints?.forEach(kp => allKeyConcepts.add(kp)));
        pageData.keyTerms?.forEach(kt => allKeyTerms.add(kt));
        pageData.prerequisites?.forEach(pr => allPrerequisites.add(pr));
        if (pageData.estimatedStudyTime) totalStudyTime += pageData.estimatedStudyTime;
        if (pageData.hasFormulas) hasFormulasInAnalysis = true;
        if (pageData.hasExercises) hasExercisesInAnalysis = true;
      }
    }
  });

  enrichedTopic.keyConcepts = Array.from(allKeyConcepts).slice(0, 10);
  enrichedTopic.keyTerms = Array.from(allKeyTerms).slice(0, 8);
  enrichedTopic.prerequisites = Array.from(allPrerequisites);
  enrichedTopic.estimatedHours = Math.max(enrichedTopic.estimatedHours || 0, Math.ceil(totalStudyTime / 60));
  enrichedTopic.hasFormulas = enrichedTopic.hasFormulas || hasFormulasInAnalysis;
  enrichedTopic.hasExercises = enrichedTopic.hasExercises || hasExercisesInAnalysis;

  if (enrichedTopic.studyTips) { // Append, don't overwrite
    if (hasFormulasInAnalysis && hasExercisesInAnalysis) enrichedTopic.studyTips += " FOCUS: Formule ed esercizi presenti.";
    else if (hasFormulasInAnalysis) enrichedTopic.studyTips += " FOCUS: Contiene formule.";
    else if (hasExercisesInAnalysis) enrichedTopic.studyTips += " FOCUS: Contiene esercizi.";
  } else { // Initialize if not present
     if (hasFormulasInAnalysis && hasExercisesInAnalysis) enrichedTopic.studyTips = "FOCUS: Formule ed esercizi presenti.";
    else if (hasFormulasInAnalysis) enrichedTopic.studyTips = "FOCUS: Contiene formule.";
    else if (hasExercisesInAnalysis) enrichedTopic.studyTips = "FOCUS: Contiene esercizi.";
    else enrichedTopic.studyTips = "Studio standard.";
  }
  return enrichedTopic;
}

async function performIntelligentOptimizationWithContext(topics, files, pageAnalysis) {
  logPhase('intelligent-optimization', `Ottimizzazione con ${pageAnalysis.length} pagine analizzate...`);
  if (!pageAnalysis || pageAnalysis.length === 0) {
    logPhase('intelligent-optimization', 'Analisi pagina per pagina non disponibile, ottimizzazione limitata.');
    return topics; // Non posso fare molto senza l'analisi
  }
  let optimizedTopics = [...topics];
  optimizedTopics = mergeSmallTopicsWithAnalysis(optimizedTopics, pageAnalysis);
  optimizedTopics = splitLargeTopicsWithAnalysis(optimizedTopics, pageAnalysis);
  optimizedTopics = reorderTopicsLogicallyWithAnalysis(optimizedTopics, pageAnalysis);
  optimizedTopics = optimizePriorityAndDifficultyWithAnalysis(optimizedTopics, pageAnalysis);
  logPhase('intelligent-optimization', `Ottimizzazione completata: ${optimizedTopics.length} argomenti`);
  return optimizedTopics;
}

function mergeSmallTopicsWithAnalysis(topics, pageAnalysis) {
  const MIN_PAGES = 5;
  const mergedTopics = [];
  let pendingSmallTopic = null;
  const pageAnalysisMap = new Map();
  pageAnalysis.forEach(page => pageAnalysisMap.set(`${page.fileIndex}-${page.pageNumber}`, page));

  for (const topic of topics) {
    if (topic.totalPages < MIN_PAGES) {
      if (pendingSmallTopic && areTopicsRelatedByAnalysis(pendingSmallTopic, topic, pageAnalysisMap)) {
        logPhase('optimization-merge', `Unendo "${pendingSmallTopic.title}" e "${topic.title}"`);
        pendingSmallTopic.title = `${pendingSmallTopic.title} & ${topic.title}`;
        pendingSmallTopic.description = `${pendingSmallTopic.description} Include anche: ${topic.description}`;
        pendingSmallTopic.pages_info.push(...topic.pages_info);
        pendingSmallTopic.totalPages += topic.totalPages;
        pendingSmallTopic.keyConcepts = [...new Set([...(pendingSmallTopic.keyConcepts || []), ...(topic.keyConcepts || [])])];
        pendingSmallTopic.estimatedHours = (pendingSmallTopic.estimatedHours || 0) + (topic.estimatedHours || 0);
        pendingSmallTopic.mergedFromAnalysis = true;
        // Non aggiungo a mergedTopics qui, aspetto il prossimo topic o la fine del loop
      } else {
        if (pendingSmallTopic) mergedTopics.push(pendingSmallTopic);
        pendingSmallTopic = topic;
      }
    } else {
      if (pendingSmallTopic) mergedTopics.push(pendingSmallTopic);
      pendingSmallTopic = null;
      mergedTopics.push(topic);
    }
  }
  if (pendingSmallTopic) mergedTopics.push(pendingSmallTopic);
  return mergedTopics;
}

function areTopicsRelatedByAnalysis(topic1, topic2, pageAnalysisMap) {
  if (!pageAnalysisMap || pageAnalysisMap.size === 0) return false; // Non posso determinare senza analisi
  const concepts1 = extractConceptsFromTopicPages(topic1, pageAnalysisMap);
  const concepts2 = extractConceptsFromTopicPages(topic2, pageAnalysisMap);
  const intersection = new Set([...concepts1].filter(x => concepts2.has(x)));
  const union = new Set([...concepts1, ...concepts2]);
  return union.size > 0 && (intersection.size / union.size) > 0.3; // Soglia per "related"
}

function extractConceptsFromTopicPages(topic, pageAnalysisMap) {
  const concepts = new Set();
  topic.pages_info?.forEach(pInfo => {
    for (let pageNum = pInfo.start_page; pageNum <= pInfo.end_page; pageNum++) {
      const pageData = pageAnalysisMap.get(`${pInfo.pdf_index}-${pageNum}`);
      if (pageData) {
        pageData.mainTopics?.forEach(mt => {
            if(mt.topicName) concepts.add(mt.topicName.toLowerCase());
            mt.keyPoints?.forEach(kp => concepts.add(kp.toLowerCase()));
        });
        pageData.keyTerms?.forEach(kt => concepts.add(kt.toLowerCase()));
        if (pageData.pageTitle) pageData.pageTitle.toLowerCase().split(/\s+/).filter(w => w.length > 3).forEach(w => concepts.add(w));
      }
    }
  });
  return concepts;
}

function splitLargeTopicsWithAnalysis(topics, pageAnalysis) {
  const MAX_PAGES = 35;
  const splitTopicsResult = [];
  const pageAnalysisMap = new Map();
  pageAnalysis.forEach(page => pageAnalysisMap.set(`${page.fileIndex}-${page.pageNumber}`, page));

  for (const topic of topics) {
    if (topic.totalPages > MAX_PAGES && topic.pages_info.length > 1 && pageAnalysis.length > 0) {
      const naturalBreaks = findNaturalBreaksInAnalysis(topic, pageAnalysisMap);
      if (naturalBreaks.length > 0) {
        const parts = createTopicPartsFromBreaks(topic, naturalBreaks, pageAnalysisMap); // Passa pageAnalysisMap
        splitTopicsResult.push(...parts);
        logPhase('optimization-split', `Suddiviso "${topic.title}" in ${parts.length} parti (analisi)`);
      } else {
         // Suddivisione semplice se non ci sono break naturali evidenti
        const midPointIndex = Math.floor(topic.pages_info.length / 2);
        if (midPointIndex === 0 && topic.pages_info.length === 1) { // Un solo blocco pages_info, proviamo a dividere le pagine
            const singlePageInfo = topic.pages_info[0];
            const midPageNum = singlePageInfo.start_page + Math.floor((singlePageInfo.end_page - singlePageInfo.start_page) / 2);
            if (midPageNum > singlePageInfo.start_page && midPageNum < singlePageInfo.end_page) {
                 const part1PagesInfo = [{...singlePageInfo, end_page: midPageNum}];
                 const part2PagesInfo = [{...singlePageInfo, start_page: midPageNum + 1}];
                 const topicPart1 = {...topic, id: `${topic.id}_part1`, title: `${topic.title} - Pt. 1`, pages_info: part1PagesInfo, totalPages: midPageNum - singlePageInfo.start_page + 1};
                 const topicPart2 = {...topic, id: `${topic.id}_part2`, title: `${topic.title} - Pt. 2`, pages_info: part2PagesInfo, totalPages: singlePageInfo.end_page - (midPageNum + 1) + 1};
                 recalculateTopicMetrics(topicPart1, pageAnalysisMap); 
                 recalculateTopicMetrics(topicPart2, pageAnalysisMap);
                 splitTopicsResult.push(topicPart1, topicPart2);
                 logPhase('optimization-split', `Suddiviso "${topic.title}" in 2 parti (pagine)`);
                 continue;
            }
        } else if (midPointIndex > 0) { // Suddivisione basata su blocchi pages_info
            const topicPart1 = {...topic, id: `${topic.id}_part1`, title: `${topic.title} - Pt. 1`, pages_info: topic.pages_info.slice(0, midPointIndex)};
            const topicPart2 = {...topic, id: `${topic.id}_part2`, title: `${topic.title} - Pt. 2`, pages_info: topic.pages_info.slice(midPointIndex)};
            recalculateTopicMetrics(topicPart1, pageAnalysisMap);
            recalculateTopicMetrics(topicPart2, pageAnalysisMap);
            splitTopicsResult.push(topicPart1, topicPart2);
            logPhase('optimization-split', `Suddiviso "${topic.title}" in 2 parti (blocchi pages_info)`);
            continue;
        }
        splitTopicsResult.push(topic); // Non è stato possibile splittare
      }
    } else {
      splitTopicsResult.push(topic);
    }
  }
  return splitTopicsResult;
}

function recalculateTopicMetrics(topic, pageAnalysisMap) {
    topic.totalPages = topic.pages_info.reduce((sum, p) => sum + (p.end_page - p.start_page + 1), 0);
    // Idealmente, ricalcolare anche keyConcepts, estimatedHours, etc. basandosi sulle nuove pages_info e pageAnalysisMap
    // Per brevità, lo omettiamo qui ma sarebbe importante in un'implementazione completa.
    const enriched = enrichTopicWithAnalysis(topic, topic.pages_info, pageAnalysisMap);
    topic.keyConcepts = enriched.keyConcepts;
    topic.estimatedHours = enriched.estimatedHours;
    topic.hasExercises = enriched.hasExercises;
    topic.hasFormulas = enriched.hasFormulas;
}


function findNaturalBreaksInAnalysis(topic, pageAnalysisMap) {
  const breaks = [];
  const allPageRefs = []; // Array di {fileIndex, pageNumber, originalPInfoIndex}
  topic.pages_info.forEach((pInfo, pInfoIndex) => {
    for (let pageNum = pInfo.start_page; pageNum <= pInfo.end_page; pageNum++) {
      allPageRefs.push({ fileIndex: pInfo.pdf_index, pageNumber: pageNum, originalPInfoIndex: pInfoIndex });
    }
  });

  if (allPageRefs.length < 10) return []; // Non splittare se troppo poche pagine totali per rilevare break significativi

  for (let i = 0; i < allPageRefs.length - 1; i++) {
    const currentRef = allPageRefs[i];
    const nextRef = allPageRefs[i+1];
    const currentAnalysis = pageAnalysisMap.get(`${currentRef.fileIndex}-${currentRef.pageNumber}`);
    const nextAnalysis = pageAnalysisMap.get(`${nextRef.fileIndex}-${nextRef.pageNumber}`);

    if (currentAnalysis && nextAnalysis) {
      const contentTypeChanged = currentAnalysis.contentType !== nextAnalysis.contentType;
      const difficultyChanged = currentAnalysis.difficulty !== nextAnalysis.difficulty;
      const topicsOverlap = doMainTopicsOverlap(currentAnalysis.mainTopics, nextAnalysis.mainTopics);
      
      let breakScore = 0;
      if (contentTypeChanged) breakScore += 0.4;
      if (difficultyChanged) breakScore += 0.3;
      if (!topicsOverlap) breakScore += 0.5;

      // Se il break avviene tra diversi blocchi pages_info originali, è un candidato più forte
      if (currentRef.originalPInfoIndex !== nextRef.originalPInfoIndex) breakScore += 0.2;

      if (breakScore >= 0.7) { // Soglia per considerare un break
        breaks.push({ pageRefIndex: i + 1, reasonScore: breakScore }); // i+1 è l'indice in allPageRefs DOPO cui splittare
      }
    }
  }
  // Scegli il break migliore se ce ne sono multipli, o più break se ben distanziati
  // Semplificazione: prendi il break con score più alto che non sia troppo vicino agli estremi
  return breaks
    .sort((a, b) => b.reasonScore - a.reasonScore)
    .filter(b => b.pageRefIndex > allPageRefs.length * 0.25 && b.pageRefIndex < allPageRefs.length * 0.75)
    .slice(0, 1); // Prendi solo il miglior break per semplicità
}

function doMainTopicsOverlap(topics1, topics2) {
  if (!topics1 || !topics2 || topics1.length === 0 || topics2.length === 0) return false;
  const names1 = new Set(topics1.map(t => t.topicName?.toLowerCase()));
  const names2 = new Set(topics2.map(t => t.topicName?.toLowerCase()));
  return [...names1].some(name => names2.has(name));
}

function createTopicPartsFromBreaks(topic, breaks, pageAnalysisMap) { // Aggiunto pageAnalysisMap
  const parts = [];
  let lastCutPInfoIndex = 0;
  let lastCutPageIndexInPInfo = -1; // -1 indica che non c'è stato taglio nel pInfo corrente

  const allPageRefs = [];
  topic.pages_info.forEach((pInfo, pInfoIndex) => {
    for (let pageNum = pInfo.start_page; pageNum <= pInfo.end_page; pageNum++) {
      allPageRefs.push({ fileIndex: pInfo.pdf_index, pageNumber: pageNum, originalPInfo: pInfo, originalPInfoIndex: pInfoIndex });
    }
  });
  
  let currentPartPagesInfo = [];
  let startIndexOfCurrentPartInAllPageRefs = 0;

  breaks.forEach((breakPoint) => { // breakPoint.pageRefIndex è dove avviene il taglio
    const breakAtRef = allPageRefs[breakPoint.pageRefIndex -1]; // L'ultima pagina della parte corrente
    const newPartPagesInfo = [];
    
    for(let i = startIndexOfCurrentPartInAllPageRefs; i < breakPoint.pageRefIndex; i++) {
        const ref = allPageRefs[i];
        let pInfoForPart = newPartPagesInfo.find(p => p.pdf_index === ref.originalPInfo.pdf_index && p.original_filename === ref.originalPInfo.original_filename);
        if (!pInfoForPart) {
            pInfoForPart = {...ref.originalPInfo, start_page: ref.pageNumber, end_page: ref.pageNumber};
            newPartPagesInfo.push(pInfoForPart);
        } else {
            pInfoForPart.end_page = ref.pageNumber; // Estendi
        }
    }
    
    if (newPartPagesInfo.length > 0) {
      const newTopicPart = { ...topic, id: `${topic.id}_part${parts.length + 1}`, title: `${topic.title} - Pt. ${parts.length + 1}`, pages_info: newPartPagesInfo };
      recalculateTopicMetrics(newTopicPart, pageAnalysisMap); // Ricalcola metriche
      parts.push(newTopicPart);
    }
    startIndexOfCurrentPartInAllPageRefs = breakPoint.pageRefIndex;
  });

  // Aggiungi l'ultima parte
  const remainingPagesInfo = [];
  for(let i = startIndexOfCurrentPartInAllPageRefs; i < allPageRefs.length; i++) {
    const ref = allPageRefs[i];
    let pInfoForPart = remainingPagesInfo.find(p => p.pdf_index === ref.originalPInfo.pdf_index && p.original_filename === ref.originalPInfo.original_filename);
    if (!pInfoForPart) {
        pInfoForPart = {...ref.originalPInfo, start_page: ref.pageNumber, end_page: ref.pageNumber};
        remainingPagesInfo.push(pInfoForPart);
    } else {
        pInfoForPart.end_page = ref.pageNumber;
    }
  }

  if (remainingPagesInfo.length > 0) {
    const lastTopicPart = { ...topic, id: `${topic.id}_part${parts.length + 1}`, title: `${topic.title} - Pt. ${parts.length + 1}`, pages_info: remainingPagesInfo };
    recalculateTopicMetrics(lastTopicPart, pageAnalysisMap); // Ricalcola metriche
    parts.push(lastTopicPart);
  }
  
  return parts.filter(p => p.totalPages > 0);
}


function reorderTopicsLogicallyWithAnalysis(topics, pageAnalysis) {
  if (!pageAnalysis || pageAnalysis.length === 0) return topics; // Non posso riordinare senza analisi
  const prerequisiteMap = buildPrerequisiteMapFromAnalysis(topics, pageAnalysis);
  const difficultyOrder = { beginner: 0, intermediate: 1, advanced: 2, undefined: 1 };
  const priorityOrder = { high: 0, medium: 1, low: 2, undefined: 1 };

  return topics.sort((a, b) => {
    const aPrereqs = prerequisiteMap.get(a.title) || [];
    const bPrereqs = prerequisiteMap.get(b.title) || [];
    if (aPrereqs.includes(b.title)) return 1;
    if (bPrereqs.includes(a.title)) return -1;

    const aDifficulty = getTopicDifficultyFromAnalysis(a, pageAnalysis);
    const bDifficulty = getTopicDifficultyFromAnalysis(b, pageAnalysis);
    if (aDifficulty !== bDifficulty) return (difficultyOrder[aDifficulty] || 1) - (difficultyOrder[bDifficulty] || 1);
    
    const aFirstPage = a.pages_info?.[0]?.start_page || 0;
    const bFirstPage = b.pages_info?.[0]?.start_page || 0;
    if (aFirstPage !== bFirstPage) return aFirstPage - bFirstPage;
    
    return (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1);
  });
}

function buildPrerequisiteMapFromAnalysis(topics, pageAnalysis) {
  const prerequisiteMap = new Map();
  const pageAnalysisMap = new Map();
  pageAnalysis.forEach(page => pageAnalysisMap.set(`${page.fileIndex}-${page.pageNumber}`, page));

  topics.forEach(topic => {
    const prerequisites = new Set();
    topic.pages_info?.forEach(pInfo => {
      for (let pageNum = pInfo.start_page; pageNum <= pInfo.end_page; pageNum++) {
        const pageData = pageAnalysisMap.get(`${pInfo.pdf_index}-${pageNum}`);
        pageData?.prerequisites?.forEach(prereq => prerequisites.add(prereq));
      }
    });
    if (prerequisites.size > 0) prerequisiteMap.set(topic.title, Array.from(prerequisites));
  });
  return prerequisiteMap;
}

function getTopicDifficultyFromAnalysis(topic, pageAnalysis) {
  const pageAnalysisMap = new Map();
  pageAnalysis.forEach(page => pageAnalysisMap.set(`${page.fileIndex}-${page.pageNumber}`, page));
  const difficulties = [];
  topic.pages_info?.forEach(pInfo => {
    for (let pageNum = pInfo.start_page; pageNum <= pInfo.end_page; pageNum++) {
      const pageData = pageAnalysisMap.get(`${pInfo.pdf_index}-${pageNum}`);
      if (pageData?.difficulty) difficulties.push(pageData.difficulty);
    }
  });
  return calculateAverageDifficulty(difficulties);
}

function optimizePriorityAndDifficultyWithAnalysis(topics, pageAnalysis) {
  if (!pageAnalysis || pageAnalysis.length === 0) return topics;
  const pageAnalysisMap = new Map();
  pageAnalysis.forEach(page => pageAnalysisMap.set(`${page.fileIndex}-${page.pageNumber}`, page));

  return topics.map(topic => {
    const pageStats = analyzeTopicPagesStatistics(topic, pageAnalysisMap);
    let priority = topic.priority || 'medium';
    if (pageStats.highImportanceRatio > 0.5) priority = 'high';
    else if (pageStats.lowImportanceRatio > 0.5 && pageStats.highImportanceRatio < 0.1) priority = 'low';
    if (pageStats.hasFormulas && pageStats.hasExercises && priority !== 'high') priority = 'high'; // Esercizi + formule = alta priorità

    let difficulty = pageStats.averageDifficulty || topic.difficulty || 'intermediate';
    const estimatedHours = Math.max(topic.estimatedHours || 1, Math.ceil(pageStats.totalEstimatedMinutes / 60) || 1);

    return { ...topic, priority, difficulty, estimatedHours, analysisEnhanced: true, analysisStats: pageStats };
  });
}

function analyzeTopicPagesStatistics(topic, pageAnalysisMap) {
  let totalEstimatedMinutes = 0, highImportanceCount = 0, lowImportanceCount = 0, pageCount = 0;
  const difficulties = [];
  let hasFormulas = false, hasExercises = false;

  topic.pages_info?.forEach(pInfo => {
    for (let pageNum = pInfo.start_page; pageNum <= pInfo.end_page; pageNum++) {
      const pageData = pageAnalysisMap.get(`${pInfo.pdf_index}-${pageNum}`);
      if (pageData) {
        pageCount++;
        if (pageData.estimatedStudyTime) totalEstimatedMinutes += pageData.estimatedStudyTime;
        if (pageData.importance === 'high') highImportanceCount++;
        if (pageData.importance === 'low') lowImportanceCount++;
        if (pageData.difficulty) difficulties.push(pageData.difficulty);
        if (pageData.hasFormulas) hasFormulas = true;
        if (pageData.hasExercises) hasExercises = true;
      }
    }
  });
  return {
    totalEstimatedMinutes,
    highImportanceRatio: pageCount > 0 ? highImportanceCount / pageCount : 0,
    lowImportanceRatio: pageCount > 0 ? lowImportanceCount / pageCount : 0,
    averageDifficulty: calculateAverageDifficulty(difficulties),
    hasFormulas, hasExercises,
    totalPagesAnalyzedInTopic: pageCount
  };
}

function calculateComprehensiveStatisticsWithAnalysis(topics, pageAnalysis) {
  const totalTopics = topics.length;
  if (totalTopics === 0) {
    return { /* ... statistiche vuote ma valide ... */ 
        totalTopics: 0, totalPages: 0, avgPagesPerTopic: 0, minPages: 0, maxPages: 0,
        priorityDistribution: {}, difficultyDistribution: {}, estimatedTotalHours: 0,
        analysisIntegration: { totalPagesAnalyzed: pageAnalysis.length, analysisQuality: calculateAnalysisQuality(pageAnalysis), contentDistribution: {}, difficultyFromAnalysis: {}, specialElements: {} },
        qualityMetrics: { avgQualityScore: 0, topicsWithExercises: 0, topicsWithFormulas: 0, analysisEnhanced: 0, analysisIntegrationScore: 0 }
    };
  }

  const totalPages = topics.reduce((sum, topic) => sum + (topic.totalPages || 0), 0);
  const avgPagesPerTopic = totalTopics > 0 ? Math.round(totalPages / totalTopics) : 0;
  const priorityDistribution = topics.reduce((acc, t) => { acc[t.priority || 'medium'] = (acc[t.priority||'medium'] || 0) + 1; return acc; }, {});
  const difficultyDistribution = topics.reduce((acc, t) => { acc[t.difficulty || 'intermediate'] = (acc[t.difficulty||'intermediate'] || 0) + 1; return acc; }, {});
  const analysisStats = calculateAnalysisBasedStatistics(pageAnalysis);

  return {
    totalTopics, totalPages, avgPagesPerTopic,
    minPages: Math.min(...topics.map(t => t.totalPages || 0)),
    maxPages: Math.max(...topics.map(t => t.totalPages || 0)),
    priorityDistribution, difficultyDistribution,
    estimatedTotalHours: topics.reduce((sum, t) => sum + (t.estimatedHours || 0), 0),
    analysisIntegration: {
      totalPagesAnalyzed: pageAnalysis.length,
      analysisQuality: calculateAnalysisQuality(pageAnalysis),
      contentDistribution: analysisStats.contentDistribution,
      difficultyFromAnalysis: analysisStats.difficultyDistribution,
      specialElements: analysisStats.specialElements
    },
    qualityMetrics: {
      avgQualityScore: parseFloat((topics.reduce((sum, t) => sum + (t.validation?.qualityScore || t.qualityScore || 0.5), 0) / totalTopics).toFixed(2)),
      topicsWithExercises: topics.filter(t => t.hasExercises).length,
      topicsWithFormulas: topics.filter(t => t.hasFormulas).length,
      analysisEnhanced: topics.filter(t => t.analysisEnhanced).length,
      analysisIntegrationScore: parseFloat(analysisStats.integrationScore.toFixed(2))
    }
  };
}

function calculateAnalysisBasedStatistics(pageAnalysis) {
  const contentDist = { theory: 0, examples: 0, exercises: 0, mixed: 0, other: 0 };
  const diffDist = { beginner: 0, intermediate: 0, advanced: 0, undefined: 0 };
  const specialElements = { formulas: 0, exercises: 0, images: 0, tables: 0 };

  pageAnalysis.forEach(page => {
    const ct = page.contentType || 'other';
    contentDist[ct] = (contentDist[ct] || 0) + 1;
    const d = page.difficulty || 'undefined';
    diffDist[d] = (diffDist[d] || 0) + 1;
    if (page.hasFormulas) specialElements.formulas++;
    if (page.hasExercises) specialElements.exercises++;
    if (page.hasImages) specialElements.images++;
    if (page.hasTables) specialElements.tables++;
  });
  const totalPages = pageAnalysis.length;
  const completeness = totalPages > 0 ? 1.0 : 0.0;
  const variety = Object.values(contentDist).filter(v => v > 0).length / Object.keys(contentDist).length || 0;
  return { contentDistribution: contentDist, difficultyDistribution: diffDist, specialElements, integrationScore: (completeness + variety) / 2 };
}

function calculateAnalysisQuality(pageAnalysis) {
  if (!pageAnalysis || pageAnalysis.length === 0) return 0.0;
  let qualitySum = 0;
  pageAnalysis.forEach(page => {
    let pq = 0.3; // Base
    if (page.pageTitle) pq += 0.1;
    if (page.mainTopics?.length > 0) pq += 0.2;
    if (page.keyTerms?.length > 0) pq += 0.1;
    if (page.difficulty) pq += 0.1;
    if (page.estimatedStudyTime) pq += 0.1;
    if (page.contentType) pq += 0.1;
    qualitySum += Math.min(1.0, pq);
  });
  return parseFloat((qualitySum / pageAnalysis.length).toFixed(2));
}

function calculateAverageDifficulty(difficulties) {
  if (!difficulties || difficulties.length === 0) return 'intermediate';
  const scores = { beginner: 1, intermediate: 2, advanced: 3 };
  const avg = difficulties.reduce((sum, d) => sum + (scores[d] || 2), 0) / difficulties.length;
  if (avg <= 1.4) return 'beginner';
  if (avg >= 2.6) return 'advanced';
  return 'intermediate';
}

function findMostCommon(array) {
  if (!array || array.length === 0) return null;
  const freq = {};
  array.forEach(item => freq[item] = (freq[item] || 0) + 1);
  return Object.keys(freq).reduce((a, b) => freq[a] > freq[b] ? a : b);
}

function calculateTopicQualityScore(topic, totalPages) {
  let score = 0.5;
  if (topic.description?.length > 30) score += 0.1;
  if (topic.keyConcepts?.length > 2) score += 0.1;
  if (topic.learningObjectives?.length > 0) score += 0.1;
  if (totalPages >= 5 && totalPages <= 30) score += 0.2;
  if (topic.priority === 'high') score += 0.1;
  if (topic.analysisEnhanced || topic.validation?.analysisIntegration) score += 0.1;
  return parseFloat(Math.min(1.0, score).toFixed(2));
}

// Rinominato da calculateQualityScore per evitare conflitti di nome
function calculateOverallQualityScore(topics) { 
  if (!topics || topics.length === 0) return 0;
  const avgQ = topics.reduce((sum, t) => sum + (t.validation?.qualityScore || t.qualityScore || 0.5), 0) / topics.length;
  const balance = calculateBalanceScore(topics);
  const coverage = topics.length >= 5 ? 1.0 : topics.length / 5.0;
  const integrated = topics.filter(t => t.analysisEnhanced || t.validation?.analysisIntegration).length / topics.length;
  return parseFloat(((avgQ + balance + coverage + integrated) / 4).toFixed(2));
}

function calculateBalanceScore(topics) {
  const pages = topics.map(t => t.totalPages || 0);
  if (pages.length <= 1) return 1.0;
  const mean = pages.reduce((sum, p) => sum + p, 0) / pages.length;
  if (mean === 0) return 0; // Evita divisione per zero
  const variance = pages.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / pages.length;
  const stdDev = Math.sqrt(variance);
  return parseFloat(Math.max(0, 1 - (stdDev / mean)).toFixed(2));
}