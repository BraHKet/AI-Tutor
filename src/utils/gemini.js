// src/utils/gemini.js - Multi-Phase Optimized Architecture - PARTE 1
import { genAI, model as geminiDefaultModel } from './geminiSetup';

// ===== CACHE E CONFIGURAZIONE =====
const PDF_CACHE = new Map(); // Cache per i PDF convertiti
const AI_RESPONSE_CACHE = new Map(); // Cache per le risposte AI
const PROCESSING_STATUS = new Map(); // Stato dei processi in corso
const PHASE_CACHE = new Map(); // Cache specifico per le fasi

// Configurazioni ottimizzate con supporto multi-fase
const CONFIG = {
  AI_GENERATION: {
    responseMimeType: "application/json",
    temperature: 0.1,
    maxOutputTokens: 8192,
  },
  CONTENT_ANALYSIS: {
    minTopicPages: 5,
    maxTopicPages: 20,
    idealTopicPages: 12,
    maxTopicsTotal: 15,
    minTopicsTotal: 5,
    // Nuove configurazioni per multi-fase
    phases: {
      structuralAnalysis: { enabled: true, priority: 1 },
      contentMapping: { enabled: true, priority: 2 },
      topicExtraction: { enabled: true, priority: 3 },
      pageAssignment: { enabled: true, priority: 4 },
      validation: { enabled: true, priority: 5 }
    }
  },
  DISTRIBUTION: {
    maxTopicsPerDay: 3,
    reserveReviewDays: true,
    phases: {
      workloadAnalysis: { enabled: true, priority: 1 },
      topicGrouping: { enabled: true, priority: 2 },
      dayDistribution: { enabled: true, priority: 3 },
      balancing: { enabled: true, priority: 4 }
    }
  },
  CACHE: {
    maxEntries: 50,
    ttlHours: 24,
    phaseMaxEntries: 100,
  }
};

// ===== UTILITY FUNCTIONS =====

/**
 * Genera un hash per identificare univocamente un set di file PDF
 */
function generateFileHash(files) {
  return files.map(f => `${f.name}-${f.size}-${f.lastModified || 'unknown'}`).join('|');
}

/**
 * Genera hash specifico per una fase del processo
 */
function generatePhaseHash(phase, examName, files, additionalParams = '') {
  const baseHash = generateFileHash(files);
  return `${phase}_${examName}_${baseHash}_${additionalParams}`;
}

/**
 * Pulisce la cache se supera i limiti
 */
function cleanupCache(cache, maxEntries = CONFIG.CACHE.maxEntries) {
  if (cache.size > maxEntries) {
    const entries = Array.from(cache.entries());
    const oldestEntries = entries.slice(0, Math.floor(maxEntries / 2));
    oldestEntries.forEach(([key]) => cache.delete(key));
  }
}

/**
 * Converte un oggetto File JavaScript in una "parte" per l'API Gemini con caching
 */
async function fileToGenerativePart(file) {
  const fileKey = `${file.name}-${file.size}-${file.lastModified || 'unknown'}`;
  
  // Controlla cache
  if (PDF_CACHE.has(fileKey)) {
    console.log(`Gemini: Using cached PDF conversion for ${file.name}`);
    return PDF_CACHE.get(fileKey);
  }

  console.log(`Gemini: Converting PDF to base64 for ${file.name}...`);
  const base64EncodedData = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result && typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1]);
      } else {
        reject(new Error('FileReader result is null or not a string'));
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });

  const generativePart = {
    inlineData: {
      data: base64EncodedData,
      mimeType: file.type || 'application/pdf',
    },
  };

  // Salva in cache
  PDF_CACHE.set(fileKey, generativePart);
  cleanupCache(PDF_CACHE);

  return generativePart;
}

/**
 * Prepara i file PDF per l'analisi AI con ottimizzazioni
 */
async function prepareFilesForAI(filesArray, originalFilesDriveInfo, progressCallback) {
  const fileHash = generateFileHash(filesArray);
  
  // Controlla se abbiamo già processato questi file
  if (PROCESSING_STATUS.has(fileHash)) {
    progressCallback?.({ type: 'processing', message: 'Riutilizzo file già processati...' });
    return PROCESSING_STATUS.get(fileHash);
  }

  progressCallback?.({ type: 'processing', message: 'Preparazione file per analisi AI...' });

  const partsArray = [];
  let validPdfFilesSent = 0;

  for (let i = 0; i < filesArray.length; i++) {
    const file = filesArray[i];
    const driveInfo = originalFilesDriveInfo.find(df => df.originalFileIndex === i);

    if (file.type === "application/pdf" && driveInfo && driveInfo.name === file.name) {
      progressCallback?.({ type: 'processing', message: `Conversione file ${i + 1}/${filesArray.length}: ${file.name}...` });
      
      try {
        const filePart = await fileToGenerativePart(file);
        partsArray.push(filePart);
        validPdfFilesSent++;
        
        progressCallback?.({ type: 'processing', message: `File ${file.name} preparato per AI.` });
      } catch (fileConvError) {
        console.error(`Errore durante la conversione del file ${file.name}:`, fileConvError);
        progressCallback?.({ type: 'warning', message: `Errore file ${file.name}, saltato.` });
      }
    } else {
      console.warn(`File ${file.name} non valido o info non corrispondenti, saltato.`);
    }
  }

  if (validPdfFilesSent === 0) {
    throw new Error('Nessun file PDF valido è stato preparato per l\'analisi AI.');
  }

  const result = { partsArray, validPdfFilesSent, totalExpected: filesArray.length };
  PROCESSING_STATUS.set(fileHash, result);
  
  return result;
}

/**
 * Esegue una singola fase AI con caching intelligente
 */
async function executeAIPhase(phaseName, promptText, filesArray, originalFilesDriveInfo, progressCallback, useFiles = true) {
  const phaseHash = generatePhaseHash(phaseName, promptText.substring(0, 100), filesArray);
  
  // Controlla cache fase
  if (PHASE_CACHE.has(phaseHash)) {
    console.log(`Gemini: Using cached result for phase ${phaseName}`);
    progressCallback?.({ type: 'processing', message: `Utilizzo cache per fase ${phaseName}...` });
    return PHASE_CACHE.get(phaseHash);
  }

  console.log(`Gemini: Executing phase ${phaseName}...`);
  progressCallback?.({ type: 'processing', message: `Esecuzione fase ${phaseName}...` });

  if (!genAI || !geminiDefaultModel) {
    throw new Error('Servizio AI Gemini non inizializzato correttamente.');
  }

  // Prepara il payload
  const parts = [{ text: promptText }];
  
  if (useFiles) {
    const { partsArray } = await prepareFilesForAI(filesArray, originalFilesDriveInfo, progressCallback);
    parts.push(...partsArray);
  }

  const requestPayload = {
    contents: [{
      role: "user",
      parts: parts
    }],
    generationConfig: CONFIG.AI_GENERATION
  };

  try {
    const aiResult = await geminiDefaultModel.generateContent(requestPayload);
    const response = aiResult.response;

    let textResponse;
    if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
      textResponse = response.candidates[0].content.parts[0].text;
    } else {
      textResponse = response.text();
    }

    let parsedResponse;
    if (typeof textResponse === 'string') {
      const cleanedResponse = textResponse.replace(/^```json\s*|```\s*$/g, '').trim();
      if (!cleanedResponse) {
        throw new Error(`Fase ${phaseName}: L'AI ha restituito una stringa vuota.`);
      }
      parsedResponse = JSON.parse(cleanedResponse);
    } else if (typeof textResponse === 'object' && textResponse !== null) {
      parsedResponse = textResponse;
    } else {
      throw new Error(`Fase ${phaseName}: Tipo di risposta AI non riconosciuto: ${typeof textResponse}`);
    }

    // Salva in cache
    PHASE_CACHE.set(phaseHash, parsedResponse);
    cleanupCache(PHASE_CACHE, CONFIG.CACHE.phaseMaxEntries);

    progressCallback?.({ type: 'processing', message: `Fase ${phaseName} completata.` });
    return parsedResponse;

  } catch (error) {
    console.error(`Gemini: Error in phase ${phaseName}:`, error);
    throw new Error(`Errore nella fase ${phaseName}: ${error.message}`);
  }
}

// src/utils/gemini.js - Multi-Phase Optimized Architecture - PARTE 2

// ===== MULTI-PHASE CONTENT ANALYSIS MODULE =====

/**
 * FASE 1: Analisi strutturale del documento
 * Identifica la struttura generale, capitoli, sezioni principali
 */
async function phaseStructuralAnalysis(examName, filesArray, originalFilesDriveInfo, userDescription, progressCallback) {
  const filesList = originalFilesDriveInfo
    .map((fInfo, index) => `- PDF Indice ${index}: ${fInfo.name}`)
    .join('\n      ');

  const promptText = `Sei un esperto nell'analisi strutturale di documenti accademici PDF.
Esame: "${examName}"

COMPITO FASE 1 - ANALISI STRUTTURALE:
Analizza la STRUTTURA GENERALE dei seguenti documenti PDF per identificare:
1. Organizzazione complessiva (capitoli, parti, sezioni)
2. Gerarchia dei contenuti (titoli principali, sottotitoli)
3. Tipologia di contenuto per sezione (teoria, esercizi, esempi, appendici)
4. Presenza di indici, sommari, bibliografie
5. Pattern ricorrenti nell'organizzazione

File da analizzare:
${filesList}

${userDescription ? `Note specifiche dell'utente: "${userDescription}"` : ''}

Restituisci ESCLUSIVAMENTE JSON:
{
  "documentStructure": [
    {
      "pdf_index": 0,
      "filename": "nome_file.pdf",
      "totalPages": 100,
      "structure": {
        "hasIndex": true,
        "indexPages": [1, 2],
        "chapters": [
          {
            "title": "Capitolo 1: Introduzione",
            "startPage": 3,
            "endPage": 15,
            "contentType": "theory",
            "subsections": [
              {
                "title": "1.1 Concetti base",
                "startPage": 3,
                "endPage": 8,
                "contentType": "theory"
              }
            ]
          }
        ],
        "appendices": [
          {
            "title": "Appendice A",
            "startPage": 90,
            "endPage": 100,
            "contentType": "reference"
          }
        ]
      }
    }
  ],
  "overallPattern": "Descrizione del pattern organizzativo comune",
  "recommendations": ["Suggerimenti per la suddivisione in argomenti"]
}`;

  return await executeAIPhase('structural_analysis', promptText, filesArray, originalFilesDriveInfo, progressCallback, true);
}

/**
 * FASE 2: Mappatura dettagliata dei contenuti
 * Identifica i contenuti specifici di ogni sezione
 */
async function phaseContentMapping(examName, structuralResult, filesArray, originalFilesDriveInfo, progressCallback) {
  const structureInfo = JSON.stringify(structuralResult.documentStructure, null, 2);

  const promptText = `Sei un esperto nell'analisi dettagliata di contenuti accademici.
Esame: "${examName}"

COMPITO FASE 2 - MAPPATURA CONTENUTI:
Basandoti sulla struttura identificata nella fase precedente, analizza il CONTENUTO DETTAGLIATO di ogni sezione per identificare:
1. Concetti e argomenti specifici trattati
2. Livello di complessità e prerequisiti
3. Relazioni tra argomenti diversi
4. Importanza relativa per l'esame
5. Presenza di formule, grafici, esempi pratici

STRUTTURA IDENTIFICATA NELLA FASE 1:
${structureInfo}

Analizza i PDF dettagliatamente e restituisci ESCLUSIVAMENTE JSON:
{
  "contentMap": [
    {
      "pdf_index": 0,
      "sections": [
        {
          "sectionId": "cap1_intro",
          "title": "Introduzione ai concetti base",
          "startPage": 3,
          "endPage": 15,
          "concepts": [
            {
              "name": "Definizioni fondamentali",
              "importance": "high",
              "complexity": "low",
              "prerequisites": [],
              "pageRange": [3, 8]
            }
          ],
          "contentTypes": ["theory", "definitions", "examples"],
          "estimatedStudyTime": "2-3 ore",
          "examRelevance": "essential"
        }
      ]
    }
  ],
  "conceptRelations": [
    {
      "concept1": "Definizioni fondamentali",
      "concept2": "Applicazioni pratiche",
      "relationship": "prerequisite",
      "strength": "strong"
    }
  ],
  "studyPriorities": [
    {
      "concept": "Definizioni fondamentali",
      "priority": 1,
      "reasoning": "Base per tutti gli altri argomenti"
    }
  ]
}`;

  return await executeAIPhase('content_mapping', promptText, filesArray, originalFilesDriveInfo, progressCallback, true);
}

/**
 * FASE 3: Estrazione e definizione degli argomenti
 * Crea gli argomenti di studio ottimali basandosi sull'analisi precedente
 */
async function phaseTopicExtraction(examName, structuralResult, contentMapResult, userDescription, progressCallback) {
  const structureInfo = JSON.stringify(structuralResult.documentStructure, null, 2);
  const contentInfo = JSON.stringify(contentMapResult.contentMap, null, 2);

  const promptText = `Sei un esperto nella creazione di piani di studio ottimali.
Esame: "${examName}"

COMPITO FASE 3 - ESTRAZIONE ARGOMENTI:
Basandoti sull'analisi strutturale e sulla mappatura dei contenuti delle fasi precedenti, crea ARGOMENTI DI STUDIO OTTIMALI che:

1. Rispettino la struttura logica identificata
2. Raggruppino concetti correlati
3. Abbiano dimensioni gestibili (${CONFIG.CONTENT_ANALYSIS.minTopicPages}-${CONFIG.CONTENT_ANALYSIS.maxTopicPages} pagine)
4. Seguano una progressione didattica logica
5. Massimizzino l'efficacia dello studio

REGOLE SPECIFICHE:
- Numero totale argomenti: ${CONFIG.CONTENT_ANALYSIS.minTopicsTotal}-${CONFIG.CONTENT_ANALYSIS.maxTopicsTotal}
- Dimensione ideale per argomento: ${CONFIG.CONTENT_ANALYSIS.idealTopicPages} pagine
- NO sovrapposizioni di pagine tra argomenti
- Rispetta le relazioni tra concetti identificate

ANALISI STRUTTURALE (Fase 1):
${structureInfo}

MAPPATURA CONTENUTI (Fase 2):
${contentInfo}

${userDescription ? `Note specifiche dell'utente: "${userDescription}"` : ''}

Restituisci ESCLUSIVAMENTE JSON:
{
  "studyTopics": [
    {
      "id": "topic_001",
      "title": "Fondamenti teorici",
      "description": "Introduzione ai concetti base e definizioni fondamentali",
      "priority": "high",
      "difficulty": "beginner",
      "estimatedHours": 3,
      "prerequisites": [],
      "concepts": ["Definizioni base", "Principi fondamentali"],
      "learningObjectives": [
        "Comprendere le definizioni fondamentali",
        "Applicare i principi base"
      ]
    }
  ],
  "topicSequence": ["topic_001", "topic_002", "topic_003"],
  "studyPathRecommendations": [
    {
      "fromTopic": "topic_001",
      "toTopic": "topic_002",
      "reasoning": "Prerequisito necessario"
    }
  ]
}`;

  return await executeAIPhase('topic_extraction', promptText, [], [], progressCallback, false);
}

/**
 * FASE 4: Assegnazione precisa delle pagine
 * Assegna le pagine specifiche a ogni argomento identificato
 */
async function phasePageAssignment(examName, structuralResult, contentMapResult, topicsResult, originalFilesDriveInfo, progressCallback) {
  const structureInfo = JSON.stringify(structuralResult.documentStructure, null, 2);
  const contentInfo = JSON.stringify(contentMapResult.contentMap, null, 2);
  const topicsInfo = JSON.stringify(topicsResult.studyTopics, null, 2);

  const promptText = `Sei un esperto nell'ottimizzazione dell'assegnazione di materiale di studio.
Esame: "${examName}"

COMPITO FASE 4 - ASSEGNAZIONE PAGINE:
Basandoti su tutte le analisi precedenti, assegna le PAGINE SPECIFICHE a ogni argomento identificato.

REGOLE CRITICHE:
1. ZERO sovrapposizioni - ogni pagina può appartenere a UN SOLO argomento
2. Rispetta i contenuti identificati nella mappatura
3. Mantieni la coerenza concettuale degli argomenti
4. Ottimizza la sequenza di apprendimento
5. Ogni argomento deve avere pagine contigue quando possibile

ANALISI STRUTTURALE:
${structureInfo}

MAPPATURA CONTENUTI:
${contentInfo}

ARGOMENTI IDENTIFICATI:
${topicsInfo}

File disponibili:
${originalFilesDriveInfo.map((f, i) => `${i}: ${f.name}`).join('\n')}

Restituisci ESCLUSIVAMENTE JSON:
{
  "pageAssignments": [
    {
      "topicId": "topic_001",
      "title": "Fondamenti teorici",
      "description": "Introduzione ai concetti base e definizioni fondamentali",
      "pages_info": [
        {
          "original_filename": "nome_file.pdf",
          "pdf_index": 0,
          "start_page": 3,
          "end_page": 15,
          "contentSummary": "Definizioni e concetti base"
        }
      ],
      "totalPages": 13,
      "estimatedStudyTime": "3 ore"
    }
  ],
  "unassignedPages": [
    {
      "pdf_index": 0,
      "pages": [1, 2],
      "reason": "Indice - non necessario per studio"
    }
  ],
  "assignmentStatistics": {
    "totalPages": 200,
    "assignedPages": 180,
    "unassignedPages": 20,
    "coveragePercentage": 90
  }
}`;

  return await executeAIPhase('page_assignment', promptText, [], [], progressCallback, false);
}

/**
 * FASE 5: Validazione e ottimizzazione finale
 * Verifica la qualità dell'assegnazione e apporta correzioni
 */
async function phaseValidationOptimization(pageAssignmentResult, originalFilesDriveInfo, progressCallback) {
  console.log("Gemini: Starting validation and optimization phase...");
  progressCallback?.({ type: 'processing', message: 'Validazione e ottimizzazione finale...' });

  const assignments = pageAssignmentResult.pageAssignments;
  
  // Converti nel formato legacy per compatibilità
  const tableOfContents = assignments.map(assignment => ({
    title: assignment.title,
    description: assignment.description,
    pages_info: assignment.pages_info || []
  }));

  // Applica validazione sovrapposizioni (funzione esistente)
  const validatedTopics = validateAndFixPageOverlaps(tableOfContents, originalFilesDriveInfo);
  
  // Statistiche finali
  const finalStats = {
    totalTopics: validatedTopics.length,
    totalAssignedPages: validatedTopics.reduce((sum, topic) => {
      return sum + (topic.pages_info?.reduce((pageSum, pInfo) => {
        return pageSum + (pInfo.end_page - pInfo.start_page + 1);
      }, 0) || 0);
    }, 0),
    averagePagesPerTopic: 0
  };
  
  finalStats.averagePagesPerTopic = finalStats.totalTopics > 0 
    ? Math.round(finalStats.totalAssignedPages / finalStats.totalTopics) 
    : 0;

  console.log("Gemini: Validation completed. Final stats:", finalStats);
  
  return {
    validatedTopics,
    statistics: finalStats,
    originalAssignments: assignments
  };
}

/**
 * Funzione di supporto per validazione sovrapposizioni (mantenuta dalla versione precedente)
 */
function validateAndFixPageOverlaps(tableOfContents, originalFilesDriveInfo) {
  console.log("Gemini: Validating and fixing page overlaps...");
  
  const pageAssignments = new Map();
  const overlappingPages = [];

  // Prima passata: raccogli tutte le assegnazioni
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

  // Se ci sono sovrapposizioni, correggile
  if (overlappingPages.length > 0) {
    console.warn(`Gemini: Found ${overlappingPages.length} overlapping pages, fixing...`);
    
    const sortedTopics = [...tableOfContents].sort((a, b) => {
      const pagesA = a.pages_info?.reduce((sum, p) => sum + (p.end_page - p.start_page + 1), 0) || 0;
      const pagesB = b.pages_info?.reduce((sum, p) => sum + (p.end_page - p.start_page + 1), 0) || 0;
      return pagesA - pagesB;
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
    
    console.log("Gemini: Page overlaps corrected successfully.");
  }

  return tableOfContents.filter(topic => 
    topic.pages_info && topic.pages_info.length > 0
  );
}

/**
 * ORCHESTRATORE MULTI-FASE PER ANALISI CONTENUTI
 * Esegue tutte le 5 fasi in sequenza con caching intelligente
 */
async function analyzeContentStructureMultiPhase(examName, filesArray, originalFilesDriveInfo, userDescription = "", progressCallback) {
  console.log('Gemini: Starting multi-phase content structure analysis...');
  
  try {
    // FASE 1: Analisi strutturale
    progressCallback?.({ type: 'processing', message: 'Fase 1/5: Analisi strutturale documenti...' });
    const structuralResult = await phaseStructuralAnalysis(examName, filesArray, originalFilesDriveInfo, userDescription, progressCallback);
    
    // FASE 2: Mappatura contenuti
    progressCallback?.({ type: 'processing', message: 'Fase 2/5: Mappatura dettagliata contenuti...' });
    const contentMapResult = await phaseContentMapping(examName, structuralResult, filesArray, originalFilesDriveInfo, progressCallback);
    
    // FASE 3: Estrazione argomenti
    progressCallback?.({ type: 'processing', message: 'Fase 3/5: Estrazione argomenti di studio...' });
    const topicsResult = await phaseTopicExtraction(examName, structuralResult, contentMapResult, userDescription, progressCallback);
    
    // FASE 4: Assegnazione pagine
    progressCallback?.({ type: 'processing', message: 'Fase 4/5: Assegnazione precisa delle pagine...' });
    const pageAssignmentResult = await phasePageAssignment(examName, structuralResult, contentMapResult, topicsResult, originalFilesDriveInfo, progressCallback);
    
    // FASE 5: Validazione e ottimizzazione
    progressCallback?.({ type: 'processing', message: 'Fase 5/5: Validazione e ottimizzazione finale...' });
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

    progressCallback?.({ type: 'processing', message: 'Analisi multi-fase completata con successo!' });
    return result;

  } catch (error) {
    console.error('Gemini: Error during multi-phase content analysis:', error);
    throw new Error(`Errore nell'analisi multi-fase dei contenuti: ${error.message}`);
  }
}

// src/utils/gemini.js - Multi-Phase Optimized Architecture - PARTE 3

// ===== MULTI-PHASE DISTRIBUTION MODULE =====

/**
 * FASE 1: Analisi del carico di lavoro
 * Analizza la complessità e il tempo necessario per ogni argomento
 */
async function phaseWorkloadAnalysis(examName, topics, totalDays, userDescription, progressCallback) {
  const topicsInfo = topics.map((topic, index) => {
    let info = `${index + 1}. ${topic.title}`;
    if (topic.description) info += ` - ${topic.description.substring(0, 100)}...`;
    if (topic.pages_info?.length > 0) {
      const totalPages = topic.pages_info.reduce((sum, p) => sum + (p.end_page - p.start_page + 1), 0);
      info += ` [${totalPages} pagine]`;
    }
    return info;
  }).join('\n');

  const promptText = `Sei un esperto nell'analisi del carico di lavoro per studi accademici.
Esame: "${examName}"
Giorni disponibili: ${totalDays}

COMPITO FASE 1 - ANALISI CARICO DI LAVORO:
Analizza ogni argomento per determinare:
1. Complessità relativa (1-5, dove 5 = molto complesso)
2. Tempo stimato di studio (ore)
3. Livello di difficoltà
4. Tipo di studio richiesto (memorizzazione, comprensione, pratica, applicazione)
5. Dipendenze e prerequisiti
6. Importanza per l'esame (1-5)

ARGOMENTI DA ANALIZZARE:
${topicsInfo}

${userDescription ? `Note specifiche dell'utente: "${userDescription}"` : ''}

Restituisci ESCLUSIVAMENTE JSON:
{
  "workloadAnalysis": [
    {
      "topicTitle": "Nome argomento",
      "complexity": 3,
      "estimatedHours": 4,
      "difficulty": "intermediate",
      "studyType": ["comprehension", "practice"],
      "examImportance": 4,
      "prerequisites": ["Argomento prerequisito"],
      "cognitiveLoad": "medium",
      "recommendedStudyMethods": ["reading", "practice_problems", "review"],
      "timeDistribution": {
        "initialStudy": 2.5,
        "practice": 1.0,
        "review": 0.5
      }
    }
  ],
  "overallWorkload": {
    "totalEstimatedHours": 45,
    "averageComplexity": 2.8,
    "hoursPerDay": 3.2,
    "workloadDistribution": "balanced"
  },
  "recommendations": [
    "Iniziare con argomenti di base",
    "Pianificare giorni di ripasso"
  ]
}`;

  return await executeAIPhase('workload_analysis', promptText, [], [], progressCallback, false);
}

/**
 * FASE 2: Raggruppamento e sequenziamento argomenti
 * Determina la migliore sequenza di studio e raggruppa argomenti correlati
 */
async function phaseTopicGrouping(examName, topics, workloadResult, totalDays, progressCallback) {
  const workloadInfo = JSON.stringify(workloadResult.workloadAnalysis, null, 2);
  const overallWorkload = JSON.stringify(workloadResult.overallWorkload, null, 2);

  const promptText = `Sei un esperto nella sequenziazione ottimale di argomenti di studio.
Esame: "${examName}"
Giorni disponibili: ${totalDays}

COMPITO FASE 2 - RAGGRUPPAMENTO E SEQUENZIAMENTO:
Basandoti sull'analisi del carico di lavoro, determina:
1. Sequenza ottimale di studio (considerando prerequisiti)
2. Argomenti che possono essere studiati insieme
3. Argomenti che richiedono giorni dedicati
4. Punti naturali per ripassi e consolidamento
5. Bilanciamento del carico cognitivo giornaliero

ANALISI CARICO DI LAVORO:
${workloadInfo}

CARICO COMPLESSIVO:
${overallWorkload}

REGOLE:
- Massimo ${CONFIG.DISTRIBUTION.maxTopicsPerDay} argomenti per giorno
- Rispetta le dipendenze e prerequisiti
- Bilancia complessità alta e bassa nello stesso giorno
- Considera il carico cognitivo cumulativo

Restituisci ESCLUSIVAMENTE JSON:
{
  "studySequence": [
    {
      "sequenceId": "seq_001",
      "topicTitle": "Fondamenti teorici",
      "position": 1,
      "reasoning": "Base necessaria per argomenti successivi"
    }
  ],
  "topicGroups": [
    {
      "groupId": "group_001",
      "groupName": "Concetti fondamentali",
      "topics": ["Fondamenti teorici", "Definizioni base"],
      "canBeStudiedTogether": true,
      "totalComplexity": 4,
      "estimatedTime": 6,
      "reasoning": "Argomenti complementari con bassa complessità"
    }
  ],
  "studyMilestones": [
    {
      "afterTopic": "Fondamenti teorici",
      "milestoneType": "checkpoint",
      "description": "Verifica comprensione base prima di procedere"
    }
  ],
  "cognitiveLoadBalance": {
    "highComplexityDays": 3,
    "mediumComplexityDays": 4,
    "lowComplexityDays": 2,
    "reviewDays": 2
  }
}`;

  return await executeAIPhase('topic_grouping', promptText, [], [], progressCallback, false);
}

/**
 * FASE 3: Distribuzione giornaliera ottimizzata
 * Assegna gli argomenti ai giorni specifici ottimizzando il carico
 */
async function phaseDayDistribution(examName, topics, workloadResult, groupingResult, totalDays, progressCallback) {
  const groupingInfo = JSON.stringify(groupingResult, null, 2);
  const workloadSummary = JSON.stringify(workloadResult.overallWorkload, null, 2);

  const promptText = `Sei un esperto nella creazione di piani di studio giornalieri ottimali.
Esame: "${examName}"
Giorni disponibili: ${totalDays}

COMPITO FASE 3 - DISTRIBUZIONE GIORNALIERA:
Basandoti su raggruppamento e sequenziamento, crea un piano giornaliero che:
1. Rispetti la sequenza ottimale identificata
2. Bilanci il carico di lavoro giornaliero
3. Eviti sovraccarico cognitivo
4. Includa punti di consolidamento naturali
5. Massimizzi l'efficacia dell'apprendimento

RAGGRUPPAMENTO E SEQUENZE:
${groupingInfo}

CARICO DI LAVORO COMPLESSIVO:
${workloadSummary}

VINCOLI:
- Esattamente ${totalDays} giorni numerati da 1 a ${totalDays}
- Massimo ${CONFIG.DISTRIBUTION.maxTopicsPerDay} argomenti per giorno
- Ogni argomento appare UNA SOLA VOLTA
- Bilanciamento del carico cognitivo

Restituisci ESCLUSIVAMENTE JSON:
{
  "dailyDistribution": [
    {
      "day": 1,
      "assignedTopics": [
        {
          "title": "Fondamenti teorici",
          "description": "Studio iniziale delle basi",
          "estimatedHours": 3,
          "complexity": 2,
          "studyType": ["reading", "comprehension"]
        }
      ],
      "dailyWorkload": {
        "totalHours": 3,
        "averageComplexity": 2,
        "cognitiveLoad": "light",
        "studyTypes": ["reading", "comprehension"]
      },
      "dayType": "foundation",
      "recommendations": [
        "Iniziare con lettura attenta",
        "Prendere appunti dettagliati"
      ]
    }
  ],
  "distributionSummary": {
    "totalTopicsAssigned": 10,
    "averageTopicsPerDay": 1.4,
    "workloadBalance": "optimal",
    "cognitiveLoadProgression": "gradual"
  },
  "studyFlow": {
    "foundationDays": [1, 2],
    "intensiveDays": [3, 4, 5],
    "applicationDays": [6, 7],
    "reviewDays": [8]
  }
}`;

  return await executeAIPhase('day_distribution', promptText, [], [], progressCallback, false);
}

/**
 * FASE 4: Bilanciamento e ottimizzazione finale
 * Perfeziona la distribuzione per massimizzare l'efficacia
 */
async function phaseBalancingOptimization(distributionResult, totalDays, originalTopics, progressCallback) {
  console.log("Gemini: Starting balancing and optimization phase...");
  progressCallback?.({ type: 'processing', message: 'Bilanciamento e ottimizzazione finale...' });

  const dailyPlan = distributionResult.dailyDistribution;
  
  // Converti nel formato legacy per compatibilità
  const convertedPlan = dailyPlan.map(dayPlan => ({
    day: dayPlan.day,
    assignedTopics: dayPlan.assignedTopics.map(topic => ({
      title: topic.title,
      description: topic.description || ""
    }))
  }));

  // Applica validazione esistente
  const validatedPlan = validateAndFixDistribution(convertedPlan, totalDays, originalTopics);
  
  // Calcola statistiche finali
  const finalStats = {
    totalDays: totalDays,
    daysWithTopics: validatedPlan.dailyPlan.filter(day => day.assignedTopics.length > 0).length,
    totalTopicsAssigned: validatedPlan.dailyPlan.reduce((sum, day) => sum + day.assignedTopics.length, 0),
    averageTopicsPerDay: 0,
    distribution: distributionResult.distributionSummary
  };
  
  finalStats.averageTopicsPerDay = finalStats.totalDays > 0 
    ? Math.round((finalStats.totalTopicsAssigned / finalStats.totalDays) * 10) / 10
    : 0;

  console.log("Gemini: Distribution optimization completed. Final stats:", finalStats);
  
  return {
    ...validatedPlan,
    statistics: finalStats,
    originalDistribution: distributionResult
  };
}

/**
 * Funzione di supporto per validazione distribuzione (mantenuta dalla versione precedente)
 */
function validateAndFixDistribution(dailyPlan, totalDays, originalTopics) {
  console.log("Gemini: Validating distribution...");
  
  // Verifica argomenti duplicati
  const allAssignedTopics = new Set();
  const duplicatedTopics = [];
  
  dailyPlan.forEach(day => {
    day.assignedTopics?.forEach(topic => {
      if (!topic.title) return;
      if (topic.title.toLowerCase().includes("ripasso")) return;
      
      if (allAssignedTopics.has(topic.title)) {
        duplicatedTopics.push(topic.title);
      } else {
        allAssignedTopics.add(topic.title);
      }
    });
  });
  
  // Correggi duplicati
  if (duplicatedTopics.length > 0) {
    console.warn("Gemini: Found duplicated topics, fixing...", duplicatedTopics);
    
    const seenTopics = new Set();
    dailyPlan.forEach(day => {
      if (!day.assignedTopics) return;
      
      day.assignedTopics = day.assignedTopics.filter(topic => {
        if (!topic.title) return false;
        if (topic.title.toLowerCase().includes("ripasso")) return true;
        
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
  const ensureExactDayCount = (plan, requestedDays) => {
    const existingDays = new Set(plan.map(day => day.day));
    const result = { dailyPlan: [...plan] };

    for (let i = 1; i <= requestedDays; i++) {
      if (!existingDays.has(i)) {
        result.dailyPlan.push({
          day: i,
          assignedTopics: []
        });
      }
    }

    result.dailyPlan = result.dailyPlan
      .filter(day => day.day <= requestedDays)
      .sort((a, b) => a.day - b.day);

    return result;
  };

  // Verifica argomenti mancanti
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
    console.warn("Gemini: Missing topics found, adding them:", missingTopics.map(t => t.title));
    
    // Aggiungi agli ultimi giorni con spazio disponibile
    for (const missingTopic of missingTopics) {
      let added = false;
      
      for (let dayObj of dailyPlan) {
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
        // Crea nuovo giorno se necessario
        const lastDay = Math.max(...dailyPlan.map(d => d.day));
        dailyPlan.push({
          day: lastDay + 1,
          assignedTopics: [{
            title: missingTopic.title,
            description: missingTopic.description || ""
          }]
        });
      }
    }
  }

  return ensureExactDayCount(dailyPlan, totalDays);
}

/**
 * ORCHESTRATORE MULTI-FASE PER DISTRIBUZIONE
 * Esegue tutte le 4 fasi in sequenza con ottimizzazioni
 */
async function distributeTopicsMultiPhase(examName, totalDays, topics, userDescription = "", progressCallback) {
  console.log('Gemini: Starting multi-phase topic distribution...');
  
  try {
    // FASE 1: Analisi carico di lavoro
    progressCallback?.({ type: 'processing', message: 'Fase 1/4: Analisi carico di lavoro...' });
    const workloadResult = await phaseWorkloadAnalysis(examName, topics, totalDays, userDescription, progressCallback);
    
    // FASE 2: Raggruppamento argomenti
    progressCallback?.({ type: 'processing', message: 'Fase 2/4: Raggruppamento e sequenziamento...' });
    const groupingResult = await phaseTopicGrouping(examName, topics, workloadResult, totalDays, progressCallback);
    
    // FASE 3: Distribuzione giornaliera
    progressCallback?.({ type: 'processing', message: 'Fase 3/4: Distribuzione giornaliera ottimizzata...' });
    const distributionResult = await phaseDayDistribution(examName, topics, workloadResult, groupingResult, totalDays, progressCallback);
    
    // FASE 4: Bilanciamento finale
    progressCallback?.({ type: 'processing', message: 'Fase 4/4: Bilanciamento e ottimizzazione finale...' });
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

    progressCallback?.({ type: 'processing', message: 'Distribuzione multi-fase completata con successo!' });
    return result;

  } catch (error) {
    console.error('Gemini: Error during multi-phase distribution:', error);
    throw new Error(`Errore nella distribuzione multi-fase: ${error.message}`);
  }
}

// src/utils/gemini.js - Multi-Phase Optimized Architecture - PARTE 4

// ===== ORCHESTRATOR MULTI-FASE PRINCIPALE =====

/**
 * FUNZIONE ORCHESTRATORE MULTI-FASE - Gestisce tutto il processo AI ottimizzato
 * Interfaccia immutata per compatibilità con CreateProject ma con processo interno multi-fase
 */
export const generateCompleteStudyPlan = async (
  examName, 
  totalDays, 
  files, 
  originalFilesDriveInfo, 
  userDescription = "", 
  progressCallback = null
) => {
  console.log('Gemini: Starting optimized multi-phase AI analysis process');
  
  try {
    // ANALISI CONTENUTI MULTI-FASE (5 fasi)
    progressCallback?.({ type: 'processing', message: 'AI - Avvio analisi multi-fase contenuti...' });
    
    const aiIndexResult = await analyzeContentStructureMultiPhase(
      examName,
      files,
      originalFilesDriveInfo,
      userDescription,
      progressCallback
    );

    const contentIndex = aiIndexResult.tableOfContents;
    const pageMapping = aiIndexResult.pageMapping || {};

    if (!contentIndex || contentIndex.length === 0) {
      throw new Error("AI non ha generato indice argomenti dai PDF.");
    }
    
    progressCallback?.({ type: 'processing', message: 'Analisi multi-fase contenuti completata.' });

    // DISTRIBUZIONE MULTI-FASE (4 fasi)
    progressCallback?.({ type: 'processing', message: 'AI - Avvio distribuzione multi-fase...' });
    
    const topicDistribution = await distributeTopicsMultiPhase(
      examName, 
      totalDays, 
      contentIndex, 
      userDescription,
      progressCallback
    );

    if (!topicDistribution || !topicDistribution.dailyPlan || topicDistribution.dailyPlan.length === 0) {
      throw new Error("AI non ha generato distribuzione giornaliera.");
    }

    progressCallback?.({ type: 'processing', message: 'Distribuzione multi-fase completata.' });

    // Restituisce il piano completo (formato immutato per compatibilità)
    const completePlan = {
      index: contentIndex,
      distribution: topicDistribution.dailyPlan,
      pageMapping: pageMapping,
      originalFilesInfo: originalFilesDriveInfo,
      // Dati aggiuntivi per debugging e miglioramenti futuri
      multiPhaseResults: {
        contentAnalysis: aiIndexResult.phaseResults,
        distribution: topicDistribution.phaseResults,
        statistics: {
          content: aiIndexResult.statistics,
          distribution: topicDistribution.statistics
        }
      }
    };

    console.log('Gemini: Multi-phase AI analysis finished successfully');
    console.log('Content phases executed:', Object.keys(aiIndexResult.phaseResults || {}));
    console.log('Distribution phases executed:', Object.keys(topicDistribution.phaseResults || {}));
    
    return completePlan;

  } catch (error) {
    console.error('Gemini: Error during multi-phase AI analysis:', error);
    throw new Error(`Errore durante l'analisi AI multi-fase: ${error.message}`);
  }
};

// ===== LEGACY FUNCTIONS - Aggiornate per compatibilità =====

/**
 * Funzione legacy per l'analisi dei contenuti
 * Ora usa il sistema multi-fase ma mantiene l'interfaccia legacy
 */
export const generateContentIndex = async (examName, filesArray, originalFilesDriveInfo, userDescription = "") => {
  console.warn('Gemini: Using legacy generateContentIndex - now powered by multi-phase analysis');
  const result = await analyzeContentStructureMultiPhase(examName, filesArray, originalFilesDriveInfo, userDescription);
  return {
    tableOfContents: result.tableOfContents,
    pageMapping: result.pageMapping
  };
};

/**
 * Funzione legacy per la distribuzione
 * Ora usa il sistema multi-fase ma mantiene l'interfaccia legacy
 */
export const distributeTopicsToDays = async (examName, totalDays, topics, userDescription = "") => {
  console.warn('Gemini: Using legacy distributeTopicsToDays - now powered by multi-phase distribution');
  const result = await distributeTopicsMultiPhase(examName, totalDays, topics, userDescription);
  return {
    dailyPlan: result.dailyPlan
  };
};

// ===== NUOVE FUNZIONI PER ACCESSO DIRETTO MULTI-FASE =====

/**
 * Accesso diretto all'analisi contenuti multi-fase
 */
export const analyzeContentMultiPhase = async (examName, filesArray, originalFilesDriveInfo, userDescription = "", progressCallback = null) => {
  return await analyzeContentStructureMultiPhase(examName, filesArray, originalFilesDriveInfo, userDescription, progressCallback);
};

/**
 * Accesso diretto alla distribuzione multi-fase
 */
export const distributeTopicsMultiPhaseAdvanced = async (examName, totalDays, topics, userDescription = "", progressCallback = null) => {
  return await distributeTopicsMultiPhase(examName, totalDays, topics, userDescription, progressCallback);
};

// ===== FUTURE ML INTEGRATION HOOKS AVANZATI =====

/**
 * Hook avanzato per ML Content Analysis con supporto multi-fase
 */
export const enableAdvancedMLContentAnalysis = (mlLibrary, options = {}) => {
  console.log('Gemini: Advanced ML Content Analysis integration not yet implemented');
  // TODO: Integrare algoritmi ML avanzati per ogni fase:
  // FASE 1: ML per riconoscimento strutture documentali
  // FASE 2: NLP per mappatura semantica contenuti
  // FASE 3: ML per clustering e estrazione argomenti ottimali
  // FASE 4: Algoritmi di ottimizzazione per assegnazione pagine
  // FASE 5: ML per validazione e correzione automatica
  
  return {
    enabled: false,
    library: mlLibrary,
    options: options,
    multiPhaseSupport: true,
    features: {
      phase1: ['document_structure_recognition', 'layout_analysis'],
      phase2: ['semantic_content_mapping', 'nlp_concept_extraction'],
      phase3: ['topic_clustering', 'optimal_topic_extraction'],
      phase4: ['page_assignment_optimization', 'content_coherence_analysis'],
      phase5: ['automated_validation', 'quality_assessment']
    }
  };
};

/**
 * Hook avanzato per ML Distribution con supporto multi-fase
 */
export const enableAdvancedMLDistribution = (mlLibrary, options = {}) => {
  console.log('Gemini: Advanced ML Distribution optimization not yet implemented');
  // TODO: Integrare algoritmi ML avanzati per ogni fase di distribuzione:
  // FASE 1: ML per analisi cognitiva del carico di lavoro
  // FASE 2: Algoritmi di sequenziamento ottimale
  // FASE 3: Ottimizzazione vincoli multi-obiettivo per distribuzione
  // FASE 4: ML per bilanciamento adattivo
  
  return {
    enabled: false,
    library: mlLibrary,
    options: options,
    multiPhaseSupport: true,
    features: {
      phase1: ['cognitive_load_analysis', 'complexity_assessment', 'time_estimation'],
      phase2: ['optimal_sequencing', 'prerequisite_analysis', 'topic_relationships'],
      phase3: ['multi_objective_optimization', 'constraint_satisfaction', 'workload_balancing'],
      phase4: ['adaptive_balancing', 'performance_optimization', 'feedback_integration']
    }
  };
};

// ===== UTILITY EXPORTS AVANZATI PER TESTING E DEBUG =====

/**
 * Utilità avanzate per debugging e testing del sistema multi-fase
 */
export const GeminiAdvancedUtils = {
  // Cache management avanzato
  clearAllCaches: () => {
    PDF_CACHE.clear();
    AI_RESPONSE_CACHE.clear();
    PROCESSING_STATUS.clear();
    PHASE_CACHE.clear();
    console.log('Gemini: All caches cleared (including phase cache)');
  },
  
  getAdvancedCacheStats: () => ({
    pdfCache: PDF_CACHE.size,
    aiResponseCache: AI_RESPONSE_CACHE.size,
    processingStatus: PROCESSING_STATUS.size,
    phaseCache: PHASE_CACHE.size,
    maxEntries: CONFIG.CACHE.maxEntries,
    phaseMaxEntries: CONFIG.CACHE.phaseMaxEntries
  }),
  
  // Configuration avanzata
  getMultiPhaseConfig: () => ({ ...CONFIG }),
  
  updateMultiPhaseConfig: (newConfig) => {
    Object.assign(CONFIG, newConfig);
    console.log('Gemini: Multi-phase configuration updated', CONFIG);
  },
  
  // Testing utilities per ogni fase
  testContentPhases: {
    structural: async (examName, files, driveInfo, userDesc) => {
      return await phaseStructuralAnalysis(examName, files, driveInfo, userDesc);
    },
    contentMapping: async (examName, structuralResult, files, driveInfo) => {
      return await phaseContentMapping(examName, structuralResult, files, driveInfo);
    },
    topicExtraction: async (examName, structuralResult, contentMapResult, userDesc) => {
      return await phaseTopicExtraction(examName, structuralResult, contentMapResult, userDesc);
    },
    pageAssignment: async (examName, structuralResult, contentMapResult, topicsResult, driveInfo) => {
      return await phasePageAssignment(examName, structuralResult, contentMapResult, topicsResult, driveInfo);
    },
    validation: async (pageAssignmentResult, driveInfo) => {
      return await phaseValidationOptimization(pageAssignmentResult, driveInfo);
    }
  },
  
  testDistributionPhases: {
    workloadAnalysis: async (examName, topics, totalDays, userDesc) => {
      return await phaseWorkloadAnalysis(examName, topics, totalDays, userDesc);
    },
    topicGrouping: async (examName, topics, workloadResult, totalDays) => {
      return await phaseTopicGrouping(examName, topics, workloadResult, totalDays);
    },
    dayDistribution: async (examName, topics, workloadResult, groupingResult, totalDays) => {
      return await phaseDayDistribution(examName, topics, workloadResult, groupingResult, totalDays);
    },
    balancing: async (distributionResult, totalDays, originalTopics) => {
      return await phaseBalancingOptimization(distributionResult, totalDays, originalTopics);
    }
  },
  
  // Performance monitoring avanzato
  getMultiPhaseMetrics: () => {
    const metrics = {
      totalPhases: 9, // 5 content + 4 distribution
      cacheHitRate: {
        pdf: PDF_CACHE.size > 0 ? 'Available' : 'No data',
        aiResponse: AI_RESPONSE_CACHE.size > 0 ? 'Available' : 'No data',
        phase: PHASE_CACHE.size > 0 ? 'Available' : 'No data'
      },
      totalCachedItems: {
        pdfConversions: PDF_CACHE.size,
        aiResponses: AI_RESPONSE_CACHE.size,
        phaseResults: PHASE_CACHE.size
      },
      memoryUsage: process?.memoryUsage?.() || 'Browser environment',
      configuredPhases: {
        contentAnalysis: Object.keys(CONFIG.CONTENT_ANALYSIS.phases),
        distribution: Object.keys(CONFIG.DISTRIBUTION.phases)
      }
    };
    
    return metrics;
  },
  
  // Debugging utilities
  enableVerboseLogging: () => {
    CONFIG.DEBUG = { verbose: true, logPhases: true };
    console.log('Gemini: Verbose logging enabled for all phases');
  },
  
  disableVerboseLogging: () => {
    CONFIG.DEBUG = { verbose: false, logPhases: false };
    console.log('Gemini: Verbose logging disabled');
  }
};

// ===== EXPORT CONFIGURATION AVANZATA =====

// Esporta configurazione multi-fase
export { CONFIG as GeminiMultiPhaseConfig };

// Esporta funzioni modulari per uso diretto
export { 
  analyzeContentStructureMultiPhase,
  distributeTopicsMultiPhase,
  prepareFilesForAI,
  executeAIPhase,
  generateFileHash,
  generatePhaseHash,
  
  // Fasi specifiche analisi contenuti
  phaseStructuralAnalysis,
  phaseContentMapping,
  phaseTopicExtraction,
  phasePageAssignment,
  phaseValidationOptimization,
  
  // Fasi specifiche distribuzione
  phaseWorkloadAnalysis,
  phaseTopicGrouping,
  phaseDayDistribution,
  phaseBalancingOptimization,
  
  // Funzioni di validazione (mantenute per compatibilità)
  validateAndFixPageOverlaps,
  validateAndFixDistribution
};

// ===== BACKWARD COMPATIBILITY LAYER =====

/**
 * Layer di compatibilità per le funzioni originali
 * Mantiene l'interfaccia legacy ma usa il nuovo sistema multi-fase
 */
export const LegacyCompatibility = {
  // Funzione originale analyzeContentStructure ora reindirizza al multi-fase
  analyzeContentStructure: async (examName, filesArray, originalFilesDriveInfo, userDescription = "", progressCallback) => {
    console.warn('Using legacy analyzeContentStructure - redirecting to multi-phase implementation');
    const result = await analyzeContentStructureMultiPhase(examName, filesArray, originalFilesDriveInfo, userDescription, progressCallback);
    return {
      tableOfContents: result.tableOfContents,
      pageMapping: result.pageMapping
    };
  },
  
  // Funzione originale distributeTopicsOptimized ora reindirizza al multi-fase
  distributeTopicsOptimized: async (examName, totalDays, topics, userDescription = "", progressCallback) => {
    console.warn('Using legacy distributeTopicsOptimized - redirecting to multi-phase implementation');
    const result = await distributeTopicsMultiPhase(examName, totalDays, topics, userDescription, progressCallback);
    return {
      dailyPlan: result.dailyPlan
    };
  }
};

// Esporta anche le funzioni legacy per compatibilità totale
export const analyzeContentStructure = LegacyCompatibility.analyzeContentStructure;
export const distributeTopicsOptimized = LegacyCompatibility.distributeTopicsOptimized;

// ===== SISTEMA DI MONITORING E ANALYTICS =====

/**
 * Sistema di monitoring per il processo multi-fase
 */
export const MultiPhaseMonitoring = {
  // Tracciamento delle performance per fase
  phasePerformanceTracker: new Map(),
  
  // Inizio tracking di una fase
  startPhaseTracking: (phaseName) => {
    const startTime = Date.now();
    MultiPhaseMonitoring.phasePerformanceTracker.set(phaseName, {
      startTime,
      endTime: null,
      duration: null,
      status: 'running'
    });
    console.log(`[TRACKING] Phase ${phaseName} started at ${new Date(startTime).toISOString()}`);
  },
  
  // Fine tracking di una fase
  endPhaseTracking: (phaseName, success = true) => {
    const endTime = Date.now();
    const tracking = MultiPhaseMonitoring.phasePerformanceTracker.get(phaseName);
    if (tracking) {
      tracking.endTime = endTime;
      tracking.duration = endTime - tracking.startTime;
      tracking.status = success ? 'completed' : 'failed';
      console.log(`[TRACKING] Phase ${phaseName} ${tracking.status} in ${tracking.duration}ms`);
    }
  },
  
  // Ottieni report delle performance
  getPerformanceReport: () => {
    const report = {};
    MultiPhaseMonitoring.phasePerformanceTracker.forEach((data, phaseName) => {
      report[phaseName] = {
        duration: data.duration,
        status: data.status,
        efficiency: data.duration ? (data.duration < 30000 ? 'high' : data.duration < 60000 ? 'medium' : 'low') : 'unknown'
      };
    });
    return report;
  },
  
  // Reset del tracking
  resetTracking: () => {
    MultiPhaseMonitoring.phasePerformanceTracker.clear();
    console.log('[TRACKING] Performance tracking reset');
  }
};

// ===== SISTEMA DI CONFIGURAZIONE DINAMICA =====

/**
 * Sistema per modificare la configurazione delle fasi a runtime
 */
export const DynamicConfiguration = {
  // Abilita/disabilita singole fasi
  togglePhase: (module, phaseName, enabled) => {
    if (CONFIG[module.toUpperCase()]?.phases?.[phaseName]) {
      CONFIG[module.toUpperCase()].phases[phaseName].enabled = enabled;
      console.log(`Phase ${phaseName} in ${module} ${enabled ? 'enabled' : 'disabled'}`);
      return true;
    }
    console.warn(`Phase ${phaseName} not found in ${module}`);
    return false;
  },
  
  // Modifica priorità di una fase
  setPhasePriority: (module, phaseName, priority) => {
    if (CONFIG[module.toUpperCase()]?.phases?.[phaseName]) {
      CONFIG[module.toUpperCase()].phases[phaseName].priority = priority;
      console.log(`Phase ${phaseName} priority set to ${priority}`);
      return true;
    }
    return false;
  },
  
  // Ottieni configurazione corrente delle fasi
  getCurrentPhaseConfig: () => {
    return {
      contentAnalysis: CONFIG.CONTENT_ANALYSIS.phases,
      distribution: CONFIG.DISTRIBUTION.phases
    };
  },
  
  // Reset configurazione alle impostazioni default
  resetToDefaults: () => {
    CONFIG.CONTENT_ANALYSIS.phases = {
      structuralAnalysis: { enabled: true, priority: 1 },
      contentMapping: { enabled: true, priority: 2 },
      topicExtraction: { enabled: true, priority: 3 },
      pageAssignment: { enabled: true, priority: 4 },
      validation: { enabled: true, priority: 5 }
    };
    CONFIG.DISTRIBUTION.phases = {
      workloadAnalysis: { enabled: true, priority: 1 },
      topicGrouping: { enabled: true, priority: 2 },
      dayDistribution: { enabled: true, priority: 3 },
      balancing: { enabled: true, priority: 4 }
    };
    console.log('Configuration reset to defaults');
  }
};

// ===== EXPORT FINALE =====

// Esporta tutto per massima flessibilità
export default {
  // Funzione principale (compatibile)
  generateCompleteStudyPlan,
  
  // Funzioni legacy
  generateContentIndex,
  distributeTopicsToDays,
  
  // Nuove funzioni multi-fase
  analyzeContentMultiPhase,
  distributeTopicsMultiPhaseAdvanced,
  
  // Sistemi avanzati
  GeminiAdvancedUtils,
  MultiPhaseMonitoring,
  DynamicConfiguration,
  
  // Configurazione
  CONFIG,
  
  // Hooks ML
  enableAdvancedMLContentAnalysis,
  enableAdvancedMLDistribution
};