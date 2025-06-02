// src/utils/gemini/distributionPhases.js - Distribution Phases (Simplified)
import { executeAIPhase, CONFIG } from './geminiCore.js';

// ===== FASE 1: Analisi carico di lavoro =====
export async function phaseWorkloadAnalysis(examName, topics, totalDays, userDescription, progressCallback) {
  const topicsInfo = topics.map((topic, index) => {
    let info = `${index + 1}. ${topic.title}`;
    if (topic.description) info += ` - ${topic.description.substring(0, 100)}`;
    if (topic.pages_info?.length > 0) {
      const totalPages = topic.pages_info.reduce((sum, p) => sum + (p.end_page - p.start_page + 1), 0);
      info += ` [${totalPages} pagine]`;
    }
    return info;
  }).join('\n');

  const promptText = `Analizza il CARICO DI LAVORO per l'esame "${examName}" (${totalDays} giorni):

ARGOMENTI:
${topicsInfo}

${userDescription ? `Note utente: "${userDescription}"` : ''}

Per ogni argomento determina:
1. Complessità (1-5)
2. Tempo stimato (ore)
3. Difficoltà (beginner/intermediate/advanced)
4. Importanza per l'esame (1-5)

JSON richiesto:
{
  "workloadAnalysis": [
    {
      "topicTitle": "Nome argomento",
      "complexity": 3,
      "estimatedHours": 4,
      "difficulty": "intermediate",
      "examImportance": 4,
      "prerequisites": ["Prerequisito se presente"]
    }
  ],
  "overallWorkload": {
    "totalEstimatedHours": 45,
    "averageComplexity": 2.8,
    "hoursPerDay": 3.2
  }
}`;

  return await executeAIPhase('workload_analysis', promptText, [], [], progressCallback, false);
}

// ===== FASE 2: Raggruppamento argomenti =====
export async function phaseTopicGrouping(examName, topics, workloadResult, totalDays, progressCallback) {
  const workloadInfo = JSON.stringify(workloadResult.workloadAnalysis, null, 2);

  const promptText = `Determina SEQUENZA e RAGGRUPPAMENTI per l'esame "${examName}" (${totalDays} giorni):

ANALISI CARICO:
${workloadInfo}

Regole:
- Massimo ${CONFIG.DISTRIBUTION.maxTopicsPerDay} argomenti per giorno
- Rispetta prerequisiti
- Bilancia complessità

JSON richiesto:
{
  "studySequence": [
    {
      "topicTitle": "Nome argomento",
      "position": 1,
      "reasoning": "Motivo posizionamento"
    }
  ],
  "topicGroups": [
    {
      "groupName": "Gruppo base",
      "topics": ["Argomento1", "Argomento2"],
      "canBeStudiedTogether": true,
      "totalComplexity": 4,
      "estimatedTime": 6
    }
  ]
}`;

  return await executeAIPhase('topic_grouping', promptText, [], [], progressCallback, false);
}

// ===== FASE 3: Distribuzione giornaliera =====
export async function phaseDayDistribution(examName, topics, workloadResult, groupingResult, totalDays, progressCallback) {
  const groupingInfo = JSON.stringify(groupingResult, null, 2);

  const promptText = `Crea PIANO GIORNALIERO per l'esame "${examName}" (${totalDays} giorni):

RAGGRUPPAMENTI:
${groupingInfo}

Vincoli:
- Esattamente ${totalDays} giorni (da 1 a ${totalDays})
- Massimo ${CONFIG.DISTRIBUTION.maxTopicsPerDay} argomenti/giorno
- Ogni argomento UNA SOLA VOLTA
- Bilancia carico giornaliero

JSON richiesto:
{
  "dailyDistribution": [
    {
      "day": 1,
      "assignedTopics": [
        {
          "title": "Nome argomento",
          "description": "Descrizione studio",
          "estimatedHours": 3,
          "complexity": 2
        }
      ],
      "dailyWorkload": {
        "totalHours": 3,
        "averageComplexity": 2
      }
    }
  ],
  "distributionSummary": {
    "totalTopicsAssigned": 10,
    "averageTopicsPerDay": 1.4
  }
}`;

  return await executeAIPhase('day_distribution', promptText, [], [], progressCallback, false);
}

// ===== FASE 4: Bilanciamento finale =====
export async function phaseBalancingOptimization(distributionResult, totalDays, originalTopics, progressCallback) {
  console.log("Distribution: Starting balancing...");
  progressCallback?.({ type: 'processing', message: 'Bilanciamento finale...' });

  const dailyPlan = distributionResult.dailyDistribution;
  
  const convertedPlan = dailyPlan.map(dayPlan => ({
    day: dayPlan.day,
    assignedTopics: dayPlan.assignedTopics.map(topic => ({
      title: topic.title,
      description: topic.description || ""
    }))
  }));

  const validatedPlan = validateAndFixDistribution(convertedPlan, totalDays, originalTopics);
  
  const finalStats = {
    totalDays: totalDays,
    daysWithTopics: validatedPlan.dailyPlan.filter(day => day.assignedTopics.length > 0).length,
    totalTopicsAssigned: validatedPlan.dailyPlan.reduce((sum, day) => sum + day.assignedTopics.length, 0)
  };
  
  finalStats.averageTopicsPerDay = finalStats.totalDays > 0 
    ? Math.round((finalStats.totalTopicsAssigned / finalStats.totalDays) * 10) / 10
    : 0;

  console.log("Distribution: Balancing completed. Stats:", finalStats);
  
  return {
    ...validatedPlan,
    statistics: finalStats,
    originalDistribution: distributionResult
  };
}

// ===== FUNZIONI DI SUPPORTO =====
function validateAndFixDistribution(dailyPlan, totalDays, originalTopics) {
  console.log("Distribution: Validating distribution...");
  
  // Rimuovi duplicati
  const allAssignedTopics = new Set();
  const duplicatedTopics = [];
  
  dailyPlan.forEach(day => {
    day.assignedTopics?.forEach(topic => {
      if (!topic.title || topic.title.toLowerCase().includes("ripasso")) return;
      
      if (allAssignedTopics.has(topic.title)) {
        duplicatedTopics.push(topic.title);
      } else {
        allAssignedTopics.add(topic.title);
      }
    });
  });
  
  if (duplicatedTopics.length > 0) {
    console.warn("Distribution: Removing duplicates:", duplicatedTopics);
    
    const seenTopics = new Set();
    dailyPlan.forEach(day => {
      if (!day.assignedTopics) return;
      
      day.assignedTopics = day.assignedTopics.filter(topic => {
        if (!topic.title || topic.title.toLowerCase().includes("ripasso")) return true;
        
        if (seenTopics.has(topic.title)) {
          return false;
        } else {
          seenTopics.add(topic.title);
          return true;
        }
      });
    });
  }
  
  // Assicura numero esatto di giorni
  const existingDays = new Set(dailyPlan.map(day => day.day));
  const result = { dailyPlan: [...dailyPlan] };

  for (let i = 1; i <= totalDays; i++) {
    if (!existingDays.has(i)) {
      result.dailyPlan.push({
        day: i,
        assignedTopics: []
      });
    }
  }

  result.dailyPlan = result.dailyPlan
    .filter(day => day.day <= totalDays)
    .sort((a, b) => a.day - b.day);

  // Aggiungi argomenti mancanti
  const topicTitlesInPlan = new Set();
  dailyPlan.forEach(day => {
    (day.assignedTopics || []).forEach(topic => {
      if (topic.title && !topic.title.toLowerCase().includes("ripasso")) {
        topicTitlesInPlan.add(topic.title);
      }
    });
  });
  
  const missingTopics = originalTopics.filter(topic => 
    topic.title && !topicTitlesInPlan.has(topic.title)
  );
  
  if (missingTopics.length > 0) {
    console.warn("Distribution: Adding missing topics:", missingTopics.map(t => t.title));
    
    for (const missingTopic of missingTopics) {
      let added = false;
      
      for (let dayObj of result.dailyPlan) {
        if ((dayObj.assignedTopics?.length || 0) < CONFIG.DISTRIBUTION.maxTopicsPerDay) {
          if (!dayObj.assignedTopics) dayObj.assignedTopics = [];
          dayObj.assignedTopics.push({
            title: missingTopic.title,
            description: missingTopic.description || ""
          });
          added = true;
          break;
        }
      }
      
      if (!added) {
        const lastDay = Math.max(...result.dailyPlan.map(d => d.day));
        result.dailyPlan.push({
          day: lastDay + 1,
          assignedTopics: [{
            title: missingTopic.title,
            description: missingTopic.description || ""
          }]
        });
      }
    }
  }

  return result;
}

// ===== ORCHESTRATORE =====
export async function distributeTopicsMultiPhase(examName, totalDays, topics, userDescription = "", progressCallback) {
  console.log('Distribution: Starting multi-phase distribution...');
  
  try {
    progressCallback?.({ type: 'processing', message: 'Fase 1/4: Analisi carico lavoro...' });
    const workloadResult = await phaseWorkloadAnalysis(examName, topics, totalDays, userDescription, progressCallback);
    
    progressCallback?.({ type: 'processing', message: 'Fase 2/4: Raggruppamento argomenti...' });
    const groupingResult = await phaseTopicGrouping(examName, topics, workloadResult, totalDays, progressCallback);
    
    progressCallback?.({ type: 'processing', message: 'Fase 3/4: Distribuzione giornaliera...' });
    const distributionResult = await phaseDayDistribution(examName, topics, workloadResult, groupingResult, totalDays, progressCallback);
    
    progressCallback?.({ type: 'processing', message: 'Fase 4/4: Bilanciamento finale...' });
    const finalResult = await phaseBalancingOptimization(distributionResult, totalDays, topics, progressCallback);
    
    const result = {
      ...finalResult,
      phaseResults: {
        workload: workloadResult,
        grouping: groupingResult,
        distribution: distributionResult,
        balancing: finalResult
      }
    };

    progressCallback?.({ type: 'processing', message: 'Distribuzione completata!' });
    return result;

  } catch (error) {
    console.error('Distribution: Error:', error);
    throw new Error(`Errore distribuzione: ${error.message}`);
  }
}