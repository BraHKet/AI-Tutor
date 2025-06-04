// src/utils/gemini/services/geminiAIService.js - SERVIZIO AI COMPLETAMENTE INDIPENDENTE

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
 * Converte file in parte generativa per Gemini
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
  
  if (file.size > 50 * 1024 * 1024) {
    throw new Error(`File ${file.name} is too large (${Math.round(file.size / 1024 / 1024)}MB > 50MB)`);
  }

  try {
    const base64EncodedData = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      const timeout = setTimeout(() => {
        reader.abort();
        reject(new Error(`Timeout reading file ${file.name}`));
      }, 60000);
      
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
 * Estrae testo dai file PDF
 * INPUT: Array di file, callback progress, modalità analisi
 * OUTPUT: Oggetto con testo estratto e metadati
 */
async function extractTextFromFilesForAI(files, progressCallback, analysisMode = 'text') {
  const fileHash = generateFileHash(files) + `_text_${analysisMode}`;
  
  const cached = getCacheItem('text', fileHash);
  if (cached) {
    progressCallback?.({ type: 'processing', message: 'Riutilizzo testo già estratto...' });
    return cached;
  }

  logPhase('text-extraction', `Estraendo testo da ${files.length} file (modalità ${analysisMode})`);
  progressCallback?.({ type: 'processing', message: 'Estrazione testo dai PDF...' });

  try {
    const { fullText, pagedTextData } = await extractTextFromFiles(files, (message) => {
      progressCallback?.({ type: 'processing', message });
    });

    if (!fullText || fullText.trim().length === 0) {
      throw new Error('Nessun testo estratto dai PDF. Verifica che i file contengano testo selezionabile.');
    }

    const cleanText = fullText.trim();
    const wordCount = cleanText.split(/\s+/).length;
    const charCount = cleanText.length;

    const maxChars = analysisMode === 'pdf' 
      ? SHARED_CONFIG.TEXT_LIMITS.maxCharsForPdf 
      : SHARED_CONFIG.TEXT_LIMITS.maxCharsForText;
    
    let processedText = cleanText;
    let chunks = [];
    let isTruncated = false;

    if (charCount > maxChars) {
      logPhase('text-extraction', `Testo troppo lungo (${charCount} > ${maxChars}), suddivido in chunk`);
      
      chunks = splitTextIntelligently(cleanText, SHARED_CONFIG.TEXT_LIMITS.chunkSize, SHARED_CONFIG.TEXT_LIMITS.overlapSize);
      
      const maxChunks = Math.ceil(maxChars / SHARED_CONFIG.TEXT_LIMITS.chunkSize);
      const selectedChunks = chunks.slice(0, maxChunks);
      
      processedText = selectedChunks.join('\n\n--- SEZIONE SUCCESSIVA ---\n\n');
      
      if (selectedChunks.length < chunks.length) {
        isTruncated = true;
        processedText += `\n\n[NOTA: Testo suddiviso in ${chunks.length} sezioni, analizzate le prime ${selectedChunks.length} sezioni più rappresentative]`;
      }
    }

    const result = {
      fullText: processedText,
      originalFullText: cleanText,
      pagedTextData,
      totalPages: pagedTextData.length,
      wordCount: wordCount,
      charCount: charCount,
      processedCharCount: processedText.length,
      chunks: chunks.length > 1 ? chunks : [],
      isTruncated: isTruncated,
      analysisMode: analysisMode
    };

    setCacheItem('text', fileHash, result);

    const message = isTruncated 
      ? `Testo processato: ${result.processedCharCount}/${charCount} caratteri (${chunks.length} sezioni)`
      : `Testo estratto: ${wordCount} parole, ${pagedTextData.length} pagine`;
    
    progressCallback?.({ type: 'processing', message });
    logPhase('text-extraction', message);
    
    return result;

  } catch (error) {
    throw createPhaseError('text-extraction', `Errore estrazione testo: ${error.message}`, error);
  }
}

/**
 * Prepara contenuti per modalità PDF
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
 * Prepara contenuti per modalità TEXT
 * INPUT: Array di file, callback progress, modalità analisi
 * OUTPUT: Stringa di testo formattata per Gemini
 */
async function prepareContentForTextMode(files, progressCallback, analysisMode) {
  logPhase('content-preparation', `Preparando contenuti per modalità TEXT`);

  const textData = await extractTextFromFilesForAI(files, progressCallback, analysisMode);
  
  if (!textData.fullText || textData.fullText.length < 100) {
    throw new Error('Testo estratto insufficiente per l\'analisi AI (meno di 100 caratteri).');
  }

  const textPart = {
    text: `\n\n=== CONTENUTO ESTRATTO DAI PDF ===\n\n${textData.fullText}\n\n=== METADATI ===\nFile: ${files.length}\nPagine: ${textData.totalPages}\nParole: ${textData.wordCount}\nCaratteri processati: ${textData.processedCharCount}/${textData.charCount}\n${textData.isTruncated ? `Testo suddiviso in ${textData.chunks.length} sezioni\n` : 'Testo completo\n'}=== FINE CONTENUTO ===\n\n`
  };

  progressCallback?.({ type: 'processing', message: `Testo preparato: ${textData.wordCount} parole` });
  logPhase('content-preparation', `Contenuto TEXT preparato: ${textPart.text.length} caratteri`);
  
  return [textPart];
}

// ===== SERVIZIO AI PRINCIPALE =====

/**
 * Esegue una chiamata AI con Gemini
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
  const cacheKey = `${phaseName}_${prompt.substring(0, 100)}_${generateFileHash(files)}_${analysisMode}`;
  const cached = getCacheItem('phase', cacheKey);
  if (cached) {
    logPhase(phaseName, 'Cache hit');
    progressCallback?.({ type: 'processing', message: `Utilizzo cache per ${phaseName}...` });
    return {
      data: cached,
      metadata: { cached: true, phaseName, analysisMode },
      success: true
    };
  }

  logPhase(phaseName, `Esecuzione AI (modalità ${analysisMode})`);
  progressCallback?.({ type: 'processing', message: `Esecuzione ${phaseName} (${analysisMode})...` });

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
    generationConfig: SHARED_CONFIG.AI_GENERATION
  };

  logPhase(phaseName, `Invio richiesta a Gemini (${parts.length} parti)`);

  // Retry logic
  const maxRetries = 3;
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const startTime = Date.now();
      
      const aiResult = await geminiDefaultModel.generateContent(requestPayload);
      const response = aiResult.response;

      const duration = Date.now() - startTime;
      logPhase(phaseName, `Risposta ricevuta in ${duration}ms`);

      let textResponse;
      if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
        textResponse = response.candidates[0].content.parts[0].text;
      } else {
        textResponse = response.text();
      }

      if (!textResponse || textResponse.trim().length === 0) {
        throw new Error('Risposta vuota dall\'AI');
      }
      
      // Log dettagliato della risposta
      logPhase(phaseName, `Risposta AI: ${textResponse.length} caratteri`, {
        rawResponse: textResponse.substring(0, 500) + '...'
      });
      
      // Parse del JSON
      const parsedResponse = cleanAndParseJSON(textResponse);
      
      if (!parsedResponse || typeof parsedResponse !== 'object') {
        throw new Error('Risposta AI non è un oggetto JSON valido');
      }
      
      logPhase(phaseName, `JSON parsato con successo`, {
        keys: Object.keys(parsedResponse)
      });
      
      // Salva in cache
      setCacheItem('phase', cacheKey, parsedResponse);

      progressCallback?.({ type: 'processing', message: `${phaseName} completato.` });
      
      return {
        data: parsedResponse,
        metadata: { 
          duration, 
          attempt, 
          phaseName, 
          analysisMode,
          partsCount: parts.length 
        },
        success: true,
        rawResponse: textResponse
      };

    } catch (error) {
      lastError = error;
      logPhase(phaseName, `Errore tentativo ${attempt}/${maxRetries}: ${error.message}`);
      
      if (attempt < maxRetries) {
        const delayMs = 1000 * attempt;
        progressCallback?.({ type: 'processing', message: `Ritentando ${phaseName}...` });
        logPhase(phaseName, `Ritento tra ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  logPhase(phaseName, `Fallito dopo ${maxRetries} tentativi`);
  throw createPhaseError(phaseName, `Errore dopo ${maxRetries} tentativi: ${lastError?.message}`, lastError);
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
    progressCallback: progressCallback
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
    throw new Error(`Output AI manca campi richiesti: ${missingFields.join(', ')}`);
  }
  
  return true;
}

// ===== EXPORT DEFAULT =====
export default {
  executeAIRequest,
  createAIServiceInput,
  validateAIServiceOutput
};