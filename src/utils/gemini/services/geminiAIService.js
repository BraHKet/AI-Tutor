// src/utils/gemini/services/geminiAIService.js - SERVIZIO AI CON FORMATO PAGINATO

import { genAI, model as geminiDefaultModel } from '../../geminiSetup.js';
import { extractTextFromFiles } from '../../pdfProcessor.js';
import { 
  SHARED_CONFIG, 
  generateFileHash, 
  getCacheItem, 
  setCacheItem, 
  cleanAndParseJSON,
  logPhase,
  createPhaseError,
  splitTextIntelligently
} from '../shared/geminiShared.js';

// ===== INPUT/OUTPUT INTERFACES =====

/**
 * @typedef {Object} AIServiceInput
 * @property {string} prompt - Prompt per l'AI
 * @property {Array} files - Array di file (opzionale)
 * @property {string} analysisMode - 'pdf' o 'text'
 * @property {string} phaseName - Nome della fase per cache
 * @property {function} progressCallback - Callback per progress (opzionale)
 */

/**
 * @typedef {Object} AIServiceOutput
 * @property {Object} data - Dati parsati dalla risposta AI
 * @property {Object} metadata - Metadati della richiesta
 * @property {boolean} success - Successo dell'operazione
 * @property {string} rawResponse - Risposta raw dell'AI (opzionale)
 */

// ===== PREPARAZIONE CONTENUTI =====

/**
 * Converte file in parte generativa per Gemini - NESSUN LIMITE
 * INPUT: File object
 * OUTPUT: Generative part object
 */
async function fileToGenerativePart(file) {
  const fileKey = `${file.name}-${file.size}-${file.lastModified || 'unknown'}`;
  
  const cached = getCacheItem('pdf', fileKey);
  if (cached) {
    return cached;
  }

  logPhase('file-conversion', `Convertendo ${file.name} in base64...`);
  
  if (!file || !(file instanceof File)) {
    throw new Error(`Invalid file object for ${file?.name || 'unknown'}`);
  }
  
  if (file.type !== 'application/pdf') {
    throw new Error(`File ${file.name} is not a PDF`);
  }

  try {
    const base64EncodedData = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      const timeout = setTimeout(() => {
        reader.abort();
        reject(new Error(`Timeout reading file ${file.name}`));
      }, 300000); // 5 minuti timeout
      
      reader.onloadend = () => {
        clearTimeout(timeout);
        if (reader.result && typeof reader.result === 'string') {
          const base64Data = reader.result.split(',')[1];
          if (!base64Data) {
            reject(new Error(`Failed to extract base64 data from ${file.name}`));
          } else {
            resolve(base64Data);
          }
        } else {
          reject(new Error(`FileReader result is null for ${file.name}`));
        }
      };
      
      reader.onerror = (error) => {
        clearTimeout(timeout);
        reject(new Error(`FileReader error for ${file.name}: ${error.message || 'Unknown error'}`));
      };
      
      reader.readAsDataURL(file);
    });

    const generativePart = {
      inlineData: {
        data: base64EncodedData,
        mimeType: file.type || 'application/pdf',
      },
    };

    setCacheItem('pdf', fileKey, generativePart);
    logPhase('file-conversion', `${file.name} convertito con successo`);
    return generativePart;
    
  } catch (error) {
    throw createPhaseError('file-conversion', `Failed to convert ${file.name}: ${error.message}`, error);
  }
}

/**
 * Estrae testo dai file PDF in formato PAGINATO - NUOVO FORMATO
 * INPUT: Array di file, callback progress, modalità analisi
 * OUTPUT: Oggetto con testo estratto in formato "PAG. X: [contenuto]"
 */
async function extractTextFromFilesForAI(files, progressCallback, analysisMode = 'text') {
  const fileHash = generateFileHash(files) + `_paginated_${analysisMode}`;
  
  const cached = getCacheItem('text', fileHash);
  if (cached) {
    progressCallback?.({ type: 'processing', message: 'Riutilizzo testo paginato già estratto...' });
    return cached;
  }

  logPhase('text-extraction', `Estraendo testo PAGINATO da ${files.length} file (modalità ${analysisMode})`);
  progressCallback?.({ type: 'processing', message: 'Estrazione testo con numerazione pagine...' });

  try {
    const { fullText, pagedTextData } = await extractTextFromFiles(files, (message) => {
      progressCallback?.({ type: 'processing', message });
    });

    if (!pagedTextData || pagedTextData.length === 0) {
      throw new Error('Nessun dato pagina estratto dai PDF. Verifica che i file contengano testo selezionabile.');
    }

    // NUOVO: Formato paginato per ogni pagina
    const paginatedText = pagedTextData
      .filter(page => page.text && page.text.trim().length > 0) // Solo pagine con contenuto
      .map((page, index) => {
        const pageNum = page.pageNumber || (index + 1);
        const cleanText = page.text.trim();
        return `PAG. ${pageNum}: [${cleanText}]`;
      })
      .join('\n\n');

    const wordCount = fullText.split(/\s+/).length;
    const charCount = paginatedText.length;

    logPhase('text-extraction', `Formato paginato: ${pagedTextData.length} pagine elaborate`);

    const result = {
      fullText: paginatedText, // NUOVO: testo in formato paginato
      originalFullText: fullText, // Mantieni originale per compatibilità
      pagedTextData: pagedTextData,
      totalPages: pagedTextData.length,
      wordCount: wordCount,
      charCount: charCount,
      processedCharCount: paginatedText.length,
      isPaginated: true, // Flag per indicare formato paginato
      analysisMode: analysisMode,
      paginationFormat: "PAG. X: [contenuto]"
    };

    setCacheItem('text', fileHash, result);

    const message = `Testo paginato estratto: ${pagedTextData.length} pagine, formato "PAG. X: [contenuto]"`;
    
    progressCallback?.({ type: 'processing', message });
    logPhase('text-extraction', message);
    
    return result;

  } catch (error) {
    throw createPhaseError('text-extraction', `Errore estrazione testo paginato: ${error.message}`, error);
  }
}

/**
 * Prepara contenuti per modalità PDF - NESSUN LIMITE
 * INPUT: Array di file, callback progress
 * OUTPUT: Array di parti generative per Gemini
 */
async function prepareContentForPdfMode(files, progressCallback) {
  logPhase('content-preparation', `Preparando ${files.length} file per modalità PDF`);

  const parts = [];
  let processedCount = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    if (file.type === "application/pdf") {
      progressCallback?.({ type: 'processing', message: `Conversione ${i + 1}/${files.length}: ${file.name}...` });
      
      try {
        const filePart = await fileToGenerativePart(file);
        parts.push(filePart);
        processedCount++;
        logPhase('content-preparation', `${file.name} preparato`);
      } catch (fileError) {
        logPhase('content-preparation', `Errore ${file.name}: ${fileError.message}`);
        progressCallback?.({ type: 'warning', message: `Errore ${file.name}: ${fileError.message}` });
      }
    }
  }

  if (processedCount === 0) {
    throw new Error('Nessun file PDF valido è stato preparato per l\'analisi AI.');
  }

  logPhase('content-preparation', `Preparati ${processedCount}/${files.length} file per modalità PDF`);
  return parts;
}

/**
 * Prepara contenuti per modalità TEXT - CON FORMATO PAGINATO
 * INPUT: Array di file, callback progress, modalità analisi
 * OUTPUT: Stringa di testo PAGINATA formattata per Gemini
 */
async function prepareContentForTextMode(files, progressCallback, analysisMode) {
  logPhase('content-preparation', `Preparando contenuti per modalità TEXT PAGINATA`);

  const textData = await extractTextFromFilesForAI(files, progressCallback, analysisMode);
  
  if (!textData.fullText || textData.fullText.length < 100) {
    throw new Error('Testo estratto insufficiente per l\'analisi AI (meno di 100 caratteri).');
  }

  const textPart = {
    text: `\n\n=== CONTENUTO ESTRATTO DAI PDF (FORMATO PAGINATO) ===\n\n${textData.fullText}\n\n=== METADATI ===\nFile: ${files.length}\nPagine totali: ${textData.totalPages}\nFormato: ${textData.paginationFormat}\nModalità: TEXT PAGINATA\n=== FINE CONTENUTO ===\n\n`
  };

  progressCallback?.({ type: 'processing', message: `Testo paginato preparato: ${textData.totalPages} pagine` });
  logPhase('content-preparation', `Contenuto TEXT PAGINATO preparato: ${textData.totalPages} pagine`);
  
  return [textPart];
}

// ===== SERVIZIO AI PRINCIPALE =====

/**
 * Esegue una chiamata AI con Gemini - CON SUPPORTO FORMATO PAGINATO
 * INPUT: AIServiceInput
 * OUTPUT: AIServiceOutput
 */
export async function executeAIRequest(input) {
  const { prompt, files = [], analysisMode = 'pdf', phaseName, progressCallback } = input;
  
  // Validazione input
  if (!prompt || typeof prompt !== 'string') {
    throw createPhaseError(phaseName, 'Prompt mancante o non valido');
  }
  
  if (!['pdf', 'text'].includes(analysisMode)) {
    throw createPhaseError(phaseName, `Modalità analisi non valida: ${analysisMode}`);
  }

  // Controlla cache
  const cacheKey = `${phaseName}_${prompt.substring(0, 100)}_${generateFileHash(files)}_${analysisMode}_paginated`;
  const cached = getCacheItem('phase', cacheKey);
  if (cached) {
    logPhase(phaseName, 'Cache hit (FORMATO PAGINATO)');
    progressCallback?.({ type: 'processing', message: `Utilizzo cache per ${phaseName} (paginato)...` });
    return {
      data: cached,
      metadata: { cached: true, phaseName, analysisMode, paginated: true },
      success: true
    };
  }

  logPhase(phaseName, `Esecuzione AI (modalità ${analysisMode} PAGINATA)`);
  progressCallback?.({ type: 'processing', message: `Esecuzione ${phaseName} (${analysisMode} paginato)...` });

  // Verifica inizializzazione Gemini
  if (!genAI || !geminiDefaultModel) {
    throw createPhaseError(phaseName, 'Servizio AI Gemini non inizializzato correttamente');
  }

  // Prepara parti della richiesta
  const parts = [{ text: prompt.trim() }];
  
  // Aggiungi contenuti in base alla modalità
  if (files && files.length > 0) {
    let contentParts;
    
    if (analysisMode === 'text') {
      contentParts = await prepareContentForTextMode(files, progressCallback, analysisMode);
    } else {
      contentParts = await prepareContentForPdfMode(files, progressCallback);
    }
    
    parts.push(...contentParts);
  }

  // Prepara payload per Gemini
  const requestPayload = {
    contents: [{
      role: "user",
      parts: parts
    }],
    generationConfig: {
      ...SHARED_CONFIG.AI_GENERATION,
      temperature: 0.1,
      maxOutputTokens: SHARED_CONFIG.AI_GENERATION.maxOutputTokens,
      responseMimeType: "application/json"
    }
  };

  logPhase(phaseName, `Invio richiesta PAGINATA a Gemini (${parts.length} parti)`);

  // Retry logic
  const maxRetries = 3;
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const startTime = Date.now();
      
      const timeoutMs = 300000; // 5 minuti timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout AI request (5 minuti)')), timeoutMs)
      );
      
      const aiPromise = geminiDefaultModel.generateContent(requestPayload);
      const aiResult = await Promise.race([aiPromise, timeoutPromise]);
      const response = aiResult.response;

      const duration = Date.now() - startTime;
      logPhase(phaseName, `Risposta PAGINATA ricevuta in ${duration}ms`);

      let textResponse;
      if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
        textResponse = response.candidates[0].content.parts[0].text;
      } else {
        textResponse = response.text();
      }

      if (!textResponse || textResponse.trim().length === 0) {
        throw new Error('Risposta vuota dall\'AI');
      }
      
      logPhase(phaseName, `Risposta AI PAGINATA: ${textResponse.length} caratteri`);
      
      // Parse del JSON
      const parsedResponse = cleanAndParseJSON(textResponse);
      
      if (!parsedResponse || typeof parsedResponse !== 'object') {
        throw new Error('Risposta AI non è un oggetto JSON valido');
      }
      
      logPhase(phaseName, `JSON PAGINATO parsato con successo`);
      
      // Salva in cache
      setCacheItem('phase', cacheKey, parsedResponse);

      progressCallback?.({ type: 'processing', message: `${phaseName} completato (formato paginato).` });
      
      return {
        data: parsedResponse,
        metadata: { 
          duration, 
          attempt, 
          phaseName, 
          analysisMode,
          partsCount: parts.length,
          paginated: true,
          responseSize: textResponse.length
        },
        success: true,
        rawResponse: textResponse.length > 10000 ? textResponse.substring(0, 10000) + '...[TRUNCATED]' : textResponse
      };

    } catch (error) {
      lastError = error;
      logPhase(phaseName, `Errore tentativo ${attempt}/${maxRetries} (PAGINATO): ${error.message}`);
      
      if (attempt < maxRetries) {
        const delayMs = 2000 * attempt;
        progressCallback?.({ type: 'processing', message: `Ritentando ${phaseName} (paginato)...` });
        logPhase(phaseName, `Ritento tra ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  logPhase(phaseName, `Fallito dopo ${maxRetries} tentativi (FORMATO PAGINATO)`);
  throw createPhaseError(phaseName, `Errore dopo ${maxRetries} tentativi (formato paginato): ${lastError?.message}`, lastError);
}

// ===== UTILITY SPECIFICHE PER IL SERVIZIO =====

/**
 * Crea un input standardizzato per il servizio AI
 */
export function createAIServiceInput(prompt, files = [], analysisMode = 'pdf', phaseName = 'unknown', progressCallback = null) {
  return {
    prompt: prompt.trim(),
    files: Array.isArray(files) ? files : [],
    analysisMode: ['pdf', 'text'].includes(analysisMode) ? analysisMode : 'pdf',
    phaseName: phaseName,
    progressCallback: progressCallback,
    paginated: true // Flag per indicare supporto formato paginato
  };
}

/**
 * Valida l'output del servizio AI
 */
export function validateAIServiceOutput(output, requiredFields = []) {
  if (!output || typeof output !== 'object') {
    throw new Error('Output del servizio AI deve essere un oggetto');
  }
  
  if (!output.success) {
    throw new Error('Servizio AI ha restituito un errore');
  }
  
  if (!output.data || typeof output.data !== 'object') {
    throw new Error('Dati dell\'output AI mancanti o non validi');
  }
  
  const missingFields = requiredFields.filter(field => !(field in output.data));
  if (missingFields.length > 0) {
    logPhase('validation', `AVVISO FORMATO PAGINATO: Campi mancanti ${missingFields.join(', ')} - continuando comunque`);
  }
  
  return true;
}

// ===== EXPORT DEFAULT =====
export default {
  executeAIRequest,
  createAIServiceInput,
  validateAIServiceOutput,
  
  // Funzioni interne esposte per uso avanzato
  fileToGenerativePart,
  extractTextFromFilesForAI,
  prepareContentForPdfMode,
  prepareContentForTextMode
};