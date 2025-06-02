// src/utils/gemini/contentAnalysisPhases.js - Content Analysis Phases (Simplified)
import { executeAIPhase, CONFIG } from './geminiCore.js';

// ===== FASE 1: Analisi strutturale =====
export async function phaseStructuralAnalysis(examName, filesArray, originalFilesDriveInfo, userDescription, progressCallback) {
  const filesList = originalFilesDriveInfo
    .map((fInfo, index) => `- PDF ${index}: ${fInfo.name}`)
    .join('\n');

  const promptText = `Analizza la STRUTTURA dei seguenti documenti PDF per l'esame "${examName}":

${filesList}

${userDescription ? `Note utente: "${userDescription}"` : ''}

Identifica:
1. Organizzazione generale (capitoli, sezioni)
2. Tipi di contenuto (teoria, esercizi, esempi)
3. Pattern organizzativi

JSON richiesto:
{
  "documentStructure": [
    {
      "pdf_index": 0,
      "filename": "nome.pdf",
      "totalPages": 100,
      "chapters": [
        {
          "title": "Capitolo 1",
          "startPage": 3,
          "endPage": 15,
          "contentType": "theory"
        }
      ]
    }
  ],
  "recommendations": ["Suggerimenti organizzazione"]
}`;

  return await executeAIPhase('structural_analysis', promptText, filesArray, originalFilesDriveInfo, progressCallback, true);
}

// ===== FASE 2: Mappatura contenuti =====
export async function phaseContentMapping(examName, structuralResult, filesArray, originalFilesDriveInfo, progressCallback) {
  const structureInfo = JSON.stringify(structuralResult.documentStructure, null, 2);

  const promptText = `Basandoti sulla struttura identificata, mappa i CONTENUTI DETTAGLIATI per l'esame "${examName}":

STRUTTURA IDENTIFICATA:
${structureInfo}

Identifica per ogni sezione:
1. Concetti specifici trattati
2. Livello di complessità
3. Importanza per l'esame

JSON richiesto:
{
  "contentMap": [
    {
      "pdf_index": 0,
      "sections": [
        {
          "title": "Sezione nome",
          "startPage": 3,
          "endPage": 15,
          "concepts": [
            {
              "name": "Concetto",
              "importance": "high",
              "complexity": "low",
              "pageRange": [3, 8]
            }
          ],
          "examRelevance": "essential"
        }
      ]
    }
  ]
}`;

  return await executeAIPhase('content_mapping', promptText, filesArray, originalFilesDriveInfo, progressCallback, true);
}

// ===== FASE 3: Estrazione argomenti =====
export async function phaseTopicExtraction(examName, structuralResult, contentMapResult, userDescription, progressCallback) {
  const structureInfo = JSON.stringify(structuralResult.documentStructure, null, 2);
  const contentInfo = JSON.stringify(contentMapResult.contentMap, null, 2);

  const promptText = `Crea ARGOMENTI DI STUDIO OTTIMALI per l'esame "${examName}":

STRUTTURA:
${structureInfo}

CONTENUTI:
${contentInfo}

${userDescription ? `Note utente: "${userDescription}"` : ''}

Regole:
- ${CONFIG.CONTENT_ANALYSIS.minTopicsTotal}-${CONFIG.CONTENT_ANALYSIS.maxTopicsTotal} argomenti totali
- ${CONFIG.CONTENT_ANALYSIS.minTopicPages}-${CONFIG.CONTENT_ANALYSIS.maxTopicPages} pagine per argomento
- Raggruppa concetti correlati
- Sequenza logica di apprendimento

JSON richiesto:
{
  "studyTopics": [
    {
      "id": "topic_001",
      "title": "Nome argomento",
      "description": "Descrizione dettagliata",
      "priority": "high",
      "difficulty": "beginner",
      "estimatedHours": 3,
      "concepts": ["Concetto1", "Concetto2"]
    }
  ],
  "topicSequence": ["topic_001", "topic_002"]
}`;

  return await executeAIPhase('topic_extraction', promptText, [], [], progressCallback, false);
}

// ===== FASE 4: Assegnazione pagine =====
export async function phasePageAssignment(examName, structuralResult, contentMapResult, topicsResult, originalFilesDriveInfo, progressCallback) {
  const structureInfo = JSON.stringify(structuralResult.documentStructure, null, 2);
  const contentInfo = JSON.stringify(contentMapResult.contentMap, null, 2);
  const topicsInfo = JSON.stringify(topicsResult.studyTopics, null, 2);

  const promptText = `Assegna PAGINE SPECIFICHE agli argomenti per l'esame "${examName}":

STRUTTURA:
${structureInfo}

CONTENUTI:
${contentInfo}

ARGOMENTI:
${topicsInfo}

File disponibili:
${originalFilesDriveInfo.map((f, i) => `${i}: ${f.name}`).join('\n')}

REGOLE CRITICHE:
- ZERO sovrapposizioni di pagine
- Pagine contigue quando possibile
- Rispetta coerenza concettuale

JSON richiesto:
{
  "pageAssignments": [
    {
      "topicId": "topic_001",
      "title": "Nome argomento",
      "description": "Descrizione",
      "pages_info": [
        {
          "original_filename": "nome.pdf",
          "pdf_index": 0,
          "start_page": 3,
          "end_page": 15
        }
      ],
      "totalPages": 13
    }
  ]
}`;

  return await executeAIPhase('page_assignment', promptText, [], [], progressCallback, false);
}

// ===== FASE 5: Validazione =====
export async function phaseValidationOptimization(pageAssignmentResult, originalFilesDriveInfo, progressCallback) {
  console.log("ContentAnalysis: Starting validation...");
  progressCallback?.({ type: 'processing', message: 'Validazione finale...' });

  const assignments = pageAssignmentResult.pageAssignments;
  
  const tableOfContents = assignments.map(assignment => ({
    title: assignment.title,
    description: assignment.description,
    pages_info: assignment.pages_info || []
  }));

  const validatedTopics = validateAndFixPageOverlaps(tableOfContents);
  
  const finalStats = {
    totalTopics: validatedTopics.length,
    totalAssignedPages: validatedTopics.reduce((sum, topic) => {
      return sum + (topic.pages_info?.reduce((pageSum, pInfo) => {
        return pageSum + (pInfo.end_page - pInfo.start_page + 1);
      }, 0) || 0);
    }, 0)
  };
  
  finalStats.averagePagesPerTopic = finalStats.totalTopics > 0 
    ? Math.round(finalStats.totalAssignedPages / finalStats.totalTopics) 
    : 0;

  console.log("ContentAnalysis: Validation completed. Stats:", finalStats);
  
  return {
    validatedTopics,
    statistics: finalStats,
    originalAssignments: assignments
  };
}

// ===== FUNZIONE DI SUPPORTO =====
function validateAndFixPageOverlaps(tableOfContents) {
  console.log("ContentAnalysis: Fixing page overlaps...");
  
  const pageAssignments = new Map();
  const overlappingPages = [];

  // Trova sovrapposizioni
  tableOfContents.forEach(topic => {
    topic.pages_info?.forEach(pInfo => {
      const pdfIndex = pInfo.pdf_index;
      if (!pageAssignments.has(pdfIndex)) {
        pageAssignments.set(pdfIndex, new Map());
      }
      
      const pageMap = pageAssignments.get(pdfIndex);
      for (let pageNum = pInfo.start_page; pageNum <= pInfo.end_page; pageNum++) {
        if (pageMap.has(pageNum)) {
          overlappingPages.push({
            pdfIndex,
            pageNum,
            topics: [pageMap.get(pageNum), topic.title]
          });
        }
        pageMap.set(pageNum, topic.title);
      }
    });
  });

  // Correggi sovrapposizioni se presenti
  if (overlappingPages.length > 0) {
    console.warn(`ContentAnalysis: Found ${overlappingPages.length} overlapping pages, fixing...`);
    
    const sortedTopics = [...tableOfContents].sort((a, b) => {
      const pagesA = a.pages_info?.reduce((sum, p) => sum + (p.end_page - p.start_page + 1), 0) || 0;
      const pagesB = b.pages_info?.reduce((sum, p) => sum + (p.end_page - p.start_page + 1), 0) || 0;
      return pagesA - pagesB; // Quelli con meno pagine hanno priorità
    });

    pageAssignments.clear();
    const correctedPageAssignments = new Map();
    
    for (const topic of sortedTopics) {
      const newPagesInfo = [];
      
      for (const pInfo of (topic.pages_info || [])) {
        const pdfIndex = pInfo.pdf_index;
        if (!correctedPageAssignments.has(pdfIndex)) {
          correctedPageAssignments.set(pdfIndex, new Map());
        }
        
        const pageMap = correctedPageAssignments.get(pdfIndex);
        let currentStartPage = null;
        let currentEndPage = null;
        
        for (let pageNum = pInfo.start_page; pageNum <= pInfo.end_page; pageNum++) {
          if (!pageMap.has(pageNum)) {
            pageMap.set(pageNum, topic.title);
            
            if (currentStartPage === null) {
              currentStartPage = pageNum;
            }
            currentEndPage = pageNum;
          } else {
            if (currentStartPage !== null && currentEndPage !== null) {
              newPagesInfo.push({
                ...pInfo,
                start_page: currentStartPage,
                end_page: currentEndPage
              });
              currentStartPage = null;
              currentEndPage = null;
            }
          }
        }
        
        if (currentStartPage !== null && currentEndPage !== null) {
          newPagesInfo.push({
            ...pInfo,
            start_page: currentStartPage,
            end_page: currentEndPage
          });
        }
      }
      
      topic.pages_info = newPagesInfo;
    }
    
    console.log("ContentAnalysis: Page overlaps fixed.");
  }

  return tableOfContents.filter(topic => 
    topic.pages_info && topic.pages_info.length > 0
  );
}

// ===== ORCHESTRATORE =====
export async function analyzeContentStructureMultiPhase(examName, filesArray, originalFilesDriveInfo, userDescription = "", progressCallback) {
  console.log('ContentAnalysis: Starting multi-phase analysis...');
  
  try {
    progressCallback?.({ type: 'processing', message: 'Fase 1/5: Analisi strutturale...' });
    const structuralResult = await phaseStructuralAnalysis(examName, filesArray, originalFilesDriveInfo, userDescription, progressCallback);
    
    progressCallback?.({ type: 'processing', message: 'Fase 2/5: Mappatura contenuti...' });
    const contentMapResult = await phaseContentMapping(examName, structuralResult, filesArray, originalFilesDriveInfo, progressCallback);
    
    progressCallback?.({ type: 'processing', message: 'Fase 3/5: Estrazione argomenti...' });
    const topicsResult = await phaseTopicExtraction(examName, structuralResult, contentMapResult, userDescription, progressCallback);
    
    progressCallback?.({ type: 'processing', message: 'Fase 4/5: Assegnazione pagine...' });
    const pageAssignmentResult = await phasePageAssignment(examName, structuralResult, contentMapResult, topicsResult, originalFilesDriveInfo, progressCallback);
    
    progressCallback?.({ type: 'processing', message: 'Fase 5/5: Validazione finale...' });
    const finalResult = await phaseValidationOptimization(pageAssignmentResult, originalFilesDriveInfo, progressCallback);
    
    const result = {
      tableOfContents: finalResult.validatedTopics,
      pageMapping: {},
      phaseResults: {
        structural: structuralResult,
        contentMap: contentMapResult,
        topics: topicsResult,
        pageAssignment: pageAssignmentResult,
        validation: finalResult
      },
      statistics: finalResult.statistics
    };

    progressCallback?.({ type: 'processing', message: 'Analisi completata!' });
    return result;

  } catch (error) {
    console.error('ContentAnalysis: Error:', error);
    throw new Error(`Errore analisi contenuti: ${error.message}`);
  }
}