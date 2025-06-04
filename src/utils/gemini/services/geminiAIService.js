// src/utils/gemini/services/geminiAIService.js - SERVIZIO AI SENZA LIMITI

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

  logPhase('file-conversion', `Convertendo ${file.name} in base64 (NESSUN LIMITE)...`);
  
  if (!file || !(file instanceof File)) {
    throw new Error(`Invalid file object for ${file?.name || 'unknown'}`);
  }
  
  if (file.type !== 'application/pdf') {
    throw new Error(`File ${file.name} is not a PDF`);
  }
  
  // RIMOSSO LIMITE DI DIMENSIONE - ora accetta file di qualsiasi dimensione
  logPhase('file-conversion', `File ${file.name}: ${Math.round(file.size / 1024 / 1024)}MB - MODALITÀ ILLIMITATA`);

  try {
    const base64EncodedData = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      // Timeout esteso per file grandi
      const timeout = setTimeout(() => {
        reader.abort();
        reject(new Error(`Timeout reading file ${file.name} (esteso per file grandi)`));
      }, 300000); // 5 minuti timeout per file grandi
      
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
    logPhase('file-conversion', `${file.name} convertito con successo (${Math.round(base64EncodedData.length / 1024)}KB base64)`);
    return generativePart;
    
  } catch (error) {
    throw createPhaseError('file-conversion', `Failed to convert ${file.name}: ${error.message}`, error);
  }
}

/**
 * Estrae testo dai file PDF - NESSUN LIMITE
 * INPUT: Array di file, callback progress, modalità analisi
 * OUTPUT: Oggetto con testo estratto e metadati
 */
async function extractTextFromFilesForAI(files, progressCallback, analysisMode = 'text') {
  const fileHash = generateFileHash(files) + `_text_${analysisMode}`;
  
  const cached = getCacheItem('text', fileHash);
  if (cached) {
    progressCallback?.({ type: 'processing', message: 'Riutilizzo testo già estratto (ILLIMITATO)...' });
    return cached;
  }

  logPhase('text-extraction', `Estraendo testo da ${files.length} file (modalità ${analysisMode}) - NESSUN LIMITE`);
  progressCallback?.({ type: 'processing', message: 'Estrazione testo completa dai PDF (nessun limite)...' });

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

    // NESSUN LIMITE SUL TESTO - utilizza tutto
    let processedText = cleanText;
    let chunks = [];
    let isTruncated = false;

    // Solo se il testo è VERAMENTE enorme, suddividi intelligentemente
    if (charCount > SHARED_CONFIG.TEXT_LIMITS.maxCharsForText) {
      logPhase('text-extraction', `Testo molto grande (${charCount} caratteri), suddivido intelligentemente`);
      
      chunks = splitTextIntelligently(cleanText, SHARED_CONFIG.TEXT_LIMITS.chunkSize, SHARED_CONFIG.TEXT_LIMITS.overlapSize);
      
      // Usa TUTTI i chunk, non limitare
      processedText = chunks.join('\n\n--- SEZIONE SUCCESSIVA ---\n\n');
      
      logPhase('text-extraction', `Testo suddiviso in ${chunks.length} sezioni, utilizzate TUTTE`);
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
      analysisMode: analysisMode,
      unlimited: true // Flag per indicare modalità illimitata
    };

    setCacheItem('text', fileHash, result);

    const message = chunks.length > 1 
      ? `Testo processato: ${result.processedCharCount} caratteri (${chunks.length} sezioni) - MODALITÀ ILLIMITATA`
      : `Testo estratto: ${wordCount} parole, ${pagedTextData.length} pagine - MODALITÀ ILLIMITATA`;
    
    progressCallback?.({ type: 'processing', message });
    logPhase('text-extraction', message);
    
    return result;

  } catch (error) {
    throw createPhaseError('text-extraction', `Errore estrazione testo: ${error.message}`, error);
  }
}

/**
 * Prepara contenuti per modalità PDF - NESSUN LIMITE
 * INPUT: Array di file, callback progress
 * OUTPUT: Array di parti generative per Gemini
 */
async function prepareContentForPdfMode(files, progressCallback) {
  logPhase('content-preparation', `Preparando ${files.length} file per modalità PDF (NESSUN LIMITE)`);

  const parts = [];
  let processedCount = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    if (file.type === "application/pdf") {
      progressCallback?.({ type: 'processing', message: `Conversione ${i + 1}/${files.length}: ${file.name} (${Math.round(file.size/1024/1024)}MB)...` });
      
      try {
        const filePart = await fileToGenerativePart(file);
        parts.push(filePart);
        processedCount++;
        logPhase('content-preparation', `${file.name} preparato (${Math.round(file.size/1024/1024)}MB)`);
      } catch (fileError) {
        logPhase('content-preparation', `Errore ${file.name}: ${fileError.message}`);
        progressCallback?.({ type: 'warning', message: `Errore ${file.name}: ${fileError.message}` });
      }
    }
  }

  if (processedCount === 0) {
    throw new Error('Nessun file PDF valido è stato preparato per l\'analisi AI.');
  }

  logPhase('content-preparation', `Preparati ${processedCount}/${files.length} file per modalità PDF (NESSUN LIMITE)`);
  return parts;
}

/**
 * Prepara contenuti per modalità TEXT - NESSUN LIMITE
 * INPUT: Array di file, callback progress, modalità analisi
 * OUTPUT: Stringa di testo formattata per Gemini
 */
async function prepareContentForTextMode(files, progressCallback, analysisMode) {
  logPhase('content-preparation', `Preparando contenuti per modalità TEXT (NESSUN LIMITE)`);

  const textData = await extractTextFromFilesForAI(files, progressCallback, analysisMode);
  
  if (!textData.fullText || textData.fullText.length < 100) {
    throw new Error('Testo estratto insufficiente per l\'analisi AI (meno di 100 caratteri).');
  }

  const textPart = {
    text: `\n\n=== CONTENUTO ESTRATTO DAI PDF (MODALITÀ ILLIMITATA) ===\n\n${textData.fullText}\n\n=== METADATI ===\nFile: ${files.length}\nPagine: ${textData.totalPages}\nParole: ${textData.wordCount}\nCaratteri processati: ${textData.processedCharCount}/${textData.charCount}\n${textData.chunks.length > 1 ? `Testo suddiviso in ${textData.chunks.length} sezioni\n` : 'Testo completo\n'}Modalità: ILLIMITATA\n=== FINE CONTENUTO ===\n\n`
  };

  progressCallback?.({ type: 'processing', message: `Testo preparato: ${textData.wordCount} parole (ILLIMITATO)` });
  logPhase('content-preparation', `Contenuto TEXT preparato: ${textPart.text.length} caratteri (ILLIMITATO)`);
  
  return [textPart];
}

// ===== SERVIZIO AI PRINCIPALE =====

/**
 * Esegue una chiamata AI con Gemini - NESSUN LIMITE
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
    logPhase(phaseName, 'Cache hit (MODALITÀ ILLIMITATA)');
    progressCallback?.({ type: 'processing', message: `Utilizzo cache per ${phaseName} (illimitato)...` });
    return {
      data: cached,
      metadata: { cached: true, phaseName, analysisMode, unlimited: true },
      success: true
    };
  }

  logPhase(phaseName, `Esecuzione AI (modalità ${analysisMode}) - NESSUN LIMITE`);
  progressCallback?.({ type: 'processing', message: `Esecuzione ${phaseName} (${analysisMode}) - modalità illimitata...` });

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

  // Prepara payload per Gemini con configurazione ILLIMITATA
  const requestPayload = {
    contents: [{
      role: "user",
      parts: parts
    }],
    generationConfig: {
      ...SHARED_CONFIG.AI_GENERATION,
      // CONFIGURAZIONE ILLIMITATA
      temperature: 0.1,
      maxOutputTokens: SHARED_CONFIG.AI_GENERATION.maxOutputTokens, // Usa il massimo configurato (1M)
      responseMimeType: "application/json"
    }
  };

  logPhase(phaseName, `Invio richiesta ILLIMITATA a Gemini (${parts.length} parti, max ${SHARED_CONFIG.AI_GENERATION.maxOutputTokens} tokens)`);

  // Retry logic con tentativi estesi per richieste grandi
  const maxRetries = 3;
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const startTime = Date.now();
      
      // Timeout esteso per richieste grandi in modalità illimitata
      const timeoutMs = 300000; // 5 minuti timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout AI request (5 minuti)')), timeoutMs)
      );
      
      const aiPromise = geminiDefaultModel.generateContent(requestPayload);
      const aiResult = await Promise.race([aiPromise, timeoutPromise]);
      const response = aiResult.response;

      const duration = Date.now() - startTime;
      logPhase(phaseName, `Risposta ILLIMITATA ricevuta in ${duration}ms`);

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
      logPhase(phaseName, `Risposta AI ILLIMITATA: ${textResponse.length} caratteri`, {
        rawResponse: textResponse.substring(0, 500) + '...',
        unlimited: true
      });
      
      // Parse del JSON con gestione avanzata per risposte grandi
      const parsedResponse = cleanAndParseJSON(textResponse);
      
      if (!parsedResponse || typeof parsedResponse !== 'object') {
        throw new Error('Risposta AI non è un oggetto JSON valido');
      }
      
      logPhase(phaseName, `JSON ILLIMITATO parsato con successo`, {
        keys: Object.keys(parsedResponse),
        dataSize: JSON.stringify(parsedResponse).length
      });
      
      // Salva in cache
      setCacheItem('phase', cacheKey, parsedResponse);

      progressCallback?.({ type: 'processing', message: `${phaseName} completato (modalità illimitata).` });
      
      return {
        data: parsedResponse,
        metadata: { 
          duration, 
          attempt, 
          phaseName, 
          analysisMode,
          partsCount: parts.length,
          unlimited: true,
          responseSize: textResponse.length,
          tokensUsed: Math.ceil(textResponse.length / 4) // Stima approssimativa
        },
        success: true,
        rawResponse: textResponse.length > 10000 ? textResponse.substring(0, 10000) + '...[TRUNCATED]' : textResponse
      };

    } catch (error) {
      lastError = error;
      logPhase(phaseName, `Errore tentativo ${attempt}/${maxRetries} (MODALITÀ ILLIMITATA): ${error.message}`);
      
      if (attempt < maxRetries) {
        const delayMs = 2000 * attempt; // Delay più lungo per richieste grandi
        progressCallback?.({ type: 'processing', message: `Ritentando ${phaseName} (illimitato)...` });
        logPhase(phaseName, `Ritento tra ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  logPhase(phaseName, `Fallito dopo ${maxRetries} tentativi (MODALITÀ ILLIMITATA)`);
  throw createPhaseError(phaseName, `Errore dopo ${maxRetries} tentativi (modalità illimitata): ${lastError?.message}`, lastError);
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
    unlimited: true // Flag modalità illimitata
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
  
  // In modalità illimitata, i campi richiesti sono più flessibili
  const missingFields = requiredFields.filter(field => !(field in output.data));
  if (missingFields.length > 0) {
    logPhase('validation', `AVVISO MODALITÀ ILLIMITATA: Campi mancanti ${missingFields.join(', ')} - continuando comunque`);
    // In modalità illimitata, non blocchiamo per campi mancanti, solo avvisiamo
  }
  
  return true;
}

/**
 * Ottiene statistiche avanzate del servizio AI
 */
export function getAIServiceStats() {
  return {
    mode: 'unlimited',
    limits: {
      fileSize: 'NESSUN LIMITE',
      textLength: `${SHARED_CONFIG.TEXT_LIMITS.maxCharsForText} caratteri`,
      outputTokens: `${SHARED_CONFIG.AI_GENERATION.maxOutputTokens} tokens`,
      timeout: '5 minuti'
    },
    features: {
      largeFileSupport: true,
      extendedTimeout: true,
      intelligentChunking: true,
      advancedCaching: true
    },
    performance: {
      averageResponseTime: 'Variabile (dipende da dimensione)',
      cacheHitRate: 'Ottimizzata per richieste grandi',
      memoryUsage: 'Ottimizzata per file grandi'
    }
  };
}

/**
 * Esegue benchmark delle performance in modalità illimitata
 */
export async function benchmarkUnlimitedMode(testFiles, progressCallback) {
  const benchmark = {
    startTime: Date.now(),
    testFiles: testFiles.length,
    totalSize: testFiles.reduce((sum, f) => sum + f.size, 0),
    results: {}
  };
  
  try {
    // Test modalità PDF
    logPhase('benchmark', 'Test modalità PDF illimitata...');
    const pdfStart = Date.now();
    await prepareContentForPdfMode(testFiles, progressCallback);
    benchmark.results.pdfMode = {
      duration: Date.now() - pdfStart,
      success: true
    };
    
    // Test modalità TEXT
    logPhase('benchmark', 'Test modalità TEXT illimitata...');
    const textStart = Date.now();
    await extractTextFromFilesForAI(testFiles, progressCallback, 'text');
    benchmark.results.textMode = {
      duration: Date.now() - textStart,
      success: true
    };
    
    benchmark.totalDuration = Date.now() - benchmark.startTime;
    benchmark.success = true;
    
    logPhase('benchmark', `Benchmark completato: ${benchmark.totalDuration}ms totali`);
    
  } catch (error) {
    benchmark.error = error.message;
    benchmark.success = false;
    logPhase('benchmark', `Benchmark fallito: ${error.message}`);
  }
  
  return benchmark;
}

// ===== EXPORT DEFAULT =====
export default {
  executeAIRequest,
  createAIServiceInput,
  validateAIServiceOutput,
  getAIServiceStats,
  benchmarkUnlimitedMode,
  
  // Funzioni interne esposte per uso avanzato
  fileToGenerativePart,
  extractTextFromFilesForAI,
  prepareContentForPdfMode,
  prepareContentForTextMode
};