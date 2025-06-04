// src/utils/gemini/modules/contentAnalysis/phase2_pageByPageAnalysis.js

import { executeAIRequest, createAIServiceInput, validateAIServiceOutput } from '../../services/geminiAIService.js';
import { logPhase, createPhaseError } from '../../shared/geminiShared.js';

/**
 * FASE 2: Analisi Dettagliata Completa Pagina per Pagina (PESANTE)
 * INPUT: examName, files, phase1Output, userDescription, analysisMode, progressCallback
 * OUTPUT: Analisi completa di ogni singola pagina
 */
export async function performComprehensivePageByPageAnalysis(input) {
  const { examName, files, phase1Output, userDescription, analysisMode, progressCallback } = input;
  
  logPhase('comprehensive-page-analysis', `FASE 2: Analisi completa ${files.length} file (${analysisMode})`);
  
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
2. **IDENTIFICA CONTENUTO SPECIFICO** - Argomenti, concetti, esempi per ogni pagina
3. **CLASSIFICA TIPO CONTENUTO** - Teoria, esercizi, esempi, formule, grafici
4. **VALUTA DIFFICOLTÀ** - Livello di complessità di ogni pagina
5. **ESTRAI ELEMENTI CHIAVE** - Termini, concetti, prerequisiti specifici
6. **STIMA TEMPO STUDIO** - Tempo necessario per studiare ogni pagina

JSON RICHIESTO:

{
  "pageByPageAnalysis": [
    {
      "fileIndex": 0,
      "fileName": "nome.pdf",
      "pageNumber": 1,
      "pageTitle": "Titolo della pagina o sezione (se identificabile)",
      "sectionContext": "A quale sezione appartiene (basato su Fase 1)",
      "contentType": "theory|examples|exercises|mixed|index|appendix|formulas",
      "mainTopics": [
        {
          "topicName": "Nome specifico argomento principale",
          "description": "Descrizione dettagliata dell'argomento",
          "importance": "critical|high|medium|low",
          "keyPoints": ["punto chiave 1", "punto chiave 2", "punto chiave 3"],
          "conceptType": "definition|theorem|example|exercise|formula|application"
        }
      ],
      "difficulty": "beginner|intermediate|advanced",
      "estimatedStudyTime": 30,
      "contentElements": {
        "hasFormulas": true,
        "formulaCount": 3,
        "hasExercises": false,
        "exerciseCount": 0,
        "hasImages": false,
        "imageCount": 0,
        "hasTables": false,
        "tableCount": 0,
        "textDensity": "low|medium|high"
      },
      "keyTerms": ["termine1", "termine2", "termine3"],
      "prerequisites": ["prerequisito1", "prerequisito2"],
      "learningObjectives": ["cosa lo studente dovrebbe imparare da questa pagina"],
      "studyNotes": "Note specifiche su come studiare questa pagina",
      "qualityIndicators": {
        "contentClarity": "excellent|good|fair|poor",
        "conceptDensity": "low|medium|high",
        "examRelevance": "critical|important|useful|peripheral"
      }
    }
  ],
  "contentSummary": {
    "totalPagesAnalyzed": 0,
    "contentDistribution": {
      "theory": 0,
      "examples": 0,
      "exercises": 0,
      "mixed": 0
    },
    "difficultyBreakdown": {
      "beginner": 0,
      "intermediate": 0,
      "advanced": 0
    },
    "specialElements": {
      "formulaPages": 0,
      "exercisePages": 0,
      "imagePages": 0,
      "tablePages": 0
    },
    "estimatedTotalStudyTime": 0
  },
  "analysisMetadata": {
    "analysisMode": "${analysisMode}",
    "completeness": "0.0-1.0",
    "confidence": "0.0-1.0",
    "processingNotes": "Note sul processo di analisi completa"
  }
}

IMPORTANTE:
- UNA ENTRY per OGNI pagina di OGNI file
- Numera le pagine in modo preciso e sequenziale
- Sii SPECIFICO su cosa contiene ogni pagina
- Mantieni coerenza con la struttura identificata nella Fase 1
- Se una pagina è "vuota" o di transizione, documentalo comunque`;

  const aiInput = createAIServiceInput(prompt, files, analysisMode, 'comprehensive-page-analysis', progressCallback);
  const result = await executeAIRequest(aiInput);
  
  validateAIServiceOutput(result, ['pageByPageAnalysis', 'contentSummary']);
  
  // Arricchisce l'analisi con il contesto della Fase 1
  const enhancedResult = enhancePageAnalysisWithPhase1Context(result.data, phase1Output);
  
  logPhase('comprehensive-page-analysis', `FASE 2 completata: ${enhancedResult.pageByPageAnalysis?.length || 0} pagine analizzate`);
  return enhancedResult;
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

/**
 * Migliora l'analisi delle pagine con il contesto della Fase 1
 */
function enhancePageAnalysisWithPhase1Context(result, phase1Output) {
  if (!result.pageByPageAnalysis || !phase1Output) return result;
  
  const sections = phase1Output.globalStructure?.mainSections || [];
  
  // Crea mappa delle sezioni per file e pagina
  const sectionMap = new Map();
  sections.forEach(section => {
    for (let page = section.startPage; page <= section.endPage; page++) {
      const key = `${section.fileIndex}-${page}`;
      sectionMap.set(key, section);
    }
  });
  
  // Arricchisce ogni pagina con il contesto della sezione
  const enhancedPages = result.pageByPageAnalysis.map(page => {
    const sectionKey = `${page.fileIndex}-${page.pageNumber}`;
    const relatedSection = sectionMap.get(sectionKey);
    
    if (relatedSection) {
      return {
        ...page,
        sectionContext: `${relatedSection.sectionTitle} (${relatedSection.sectionType})`,
        sectionImportance: relatedSection.importance,
        // Aggiusta priorità in base alla sezione
        qualityIndicators: {
          ...page.qualityIndicators,
          examRelevance: adjustExamRelevanceBasedOnSection(page.qualityIndicators?.examRelevance, relatedSection.importance)
        }
      };
    }
    
    return page;
  });
  
  return {
    ...result,
    pageByPageAnalysis: enhancedPages,
    enhancement: {
      sectionsMatched: enhancedPages.filter(p => p.sectionContext).length,
      totalPages: enhancedPages.length,
      enhancementApplied: true
    }
  };
}

/**
 * Aggiusta la rilevanza per l'esame basandosi sull'importanza della sezione
 */
function adjustExamRelevanceBasedOnSection(currentRelevance, sectionImportance) {
  if (sectionImportance === 'high') return 'critical';
  if (sectionImportance === 'medium' && currentRelevance !== 'critical') return 'important';
  if (sectionImportance === 'low') return 'peripheral';
  return currentRelevance || 'useful';
}