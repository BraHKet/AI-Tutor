// src/utils/gemini/modules/contentAnalysis/phase4_validation.js

import { logPhase } from '../../shared/geminiShared.js';

/**
 * FASE 4: Validazione e Ottimizzazione Finale
 * INPUT: synthesisResult (da Fase 3), files, initialComprehensiveAnalysisResult (da Fase 2)
 * OUTPUT: Argomenti validati e ottimizzati in formato semplificato
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
      statistics: {
        totalTopics: 0,
        totalPages: 0,
        avgPagesPerTopic: 0,
        estimatedTotalHours: 0
      },
      validationReport: {
        originalCount: 0,
        validatedCount: 0,
        optimizationsApplied: false,
        qualityScore: 0
      }
    };
  }

  progressCallback?.({ type: 'processing', message: `Fase 4: Validazione e ottimizzazione...` });
  
  const validatedTopics = await performSimpleValidation(topics, files, originalPageAnalysis);
  const finalStats = calculateSimpleStatistics(validatedTopics);
  
  logPhase('final-validation', `FASE 4 completata: ${validatedTopics.length} argomenti finali`);
  
  return {
    validatedTopics: validatedTopics,
    statistics: finalStats,
    validationReport: {
      originalCount: topics.length,
      validatedCount: validatedTopics.length,
      optimizationsApplied: validatedTopics.length !== topics.length,
      qualityScore: calculateSimpleQualityScore(validatedTopics)
    }
  };
}

async function performSimpleValidation(topics, files, pageAnalysis) {
  logPhase('simple-validation', `Validazione di ${topics.length} argomenti...`);
  const validatedTopics = [];
  
  for (const topic of topics) {
    if (!topic.title || topic.startPage <= 0 || topic.endPage < topic.startPage) {
      logPhase('simple-validation', `Scartato "${topic.title}" (dati non validi)`);
      continue;
    }
    
    const fileIndex = topic.fileIndex || 0;
    if (fileIndex < 0 || fileIndex >= files.length) {
      logPhase('simple-validation', `Scartato "${topic.title}" - file index ${fileIndex} non valido`);
      continue;
    }
    
    // Valida il range di pagine
    const startPage = Math.max(1, topic.startPage);
    const endPage = Math.max(startPage, topic.endPage);
    const totalPages = endPage - startPage + 1;
    
    // Converti nel formato finale atteso dal sistema
    const validatedTopic = {
      title: topic.title.trim(),
      description: `Studio di ${topic.title} (pagine ${startPage}-${endPage})`,
      pages_info: [{
        pdf_index: fileIndex,
        original_filename: files[fileIndex].name,
        start_page: startPage,
        end_page: endPage,
        content_notes: `Contenuto ${topic.title}`
      }],
      totalPages: totalPages,
      priority: topic.difficulty === 'advanced' ? 'high' : 
               topic.difficulty === 'beginner' ? 'low' : 'medium',
      difficulty: topic.difficulty || 'intermediate',
      estimatedHours: topic.estimatedHours || Math.max(1, Math.ceil(totalPages / 6)),
      learningObjectives: [`Apprendere ${topic.title}`],
      keyConcepts: [topic.title],
      hasExercises: false,
      hasFormulas: false,
      studyTips: `Studio standard per ${topic.title}`,
      prerequisites: []
    };
    
    validatedTopics.push(validatedTopic);
  }
  
  logPhase('simple-validation', `Validazione completata: ${validatedTopics.length}/${topics.length} argomenti validi`);
  return validatedTopics;
}

function calculateSimpleStatistics(topics) {
  const totalTopics = topics.length;
  if (totalTopics === 0) {
    return { 
      totalTopics: 0, 
      totalPages: 0, 
      avgPagesPerTopic: 0,
      estimatedTotalHours: 0,
      priorityDistribution: {},
      difficultyDistribution: {}
    };
  }

  const totalPages = topics.reduce((sum, topic) => sum + (topic.totalPages || 0), 0);
  const avgPagesPerTopic = Math.round(totalPages / totalTopics);
  const estimatedTotalHours = topics.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
  
  const priorityDistribution = topics.reduce((acc, t) => { 
    acc[t.priority || 'medium'] = (acc[t.priority || 'medium'] || 0) + 1; 
    return acc; 
  }, {});
  
  const difficultyDistribution = topics.reduce((acc, t) => { 
    acc[t.difficulty || 'intermediate'] = (acc[t.difficulty || 'intermediate'] || 0) + 1; 
    return acc; 
  }, {});

  return {
    totalTopics,
    totalPages,
    avgPagesPerTopic,
    estimatedTotalHours,
    priorityDistribution,
    difficultyDistribution
  };
}

function calculateSimpleQualityScore(topics) {
  if (!topics || topics.length === 0) return 0;
  
  let totalScore = 0;
  topics.forEach(topic => {
    let score = 0.5; // Base score
    if (topic.title && topic.title.length > 5) score += 0.2;
    if (topic.totalPages >= 3 && topic.totalPages <= 25) score += 0.2;
    if (topic.estimatedHours > 0) score += 0.1;
    totalScore += Math.min(1.0, score);
  });
  
  return parseFloat((totalScore / topics.length).toFixed(2));
}