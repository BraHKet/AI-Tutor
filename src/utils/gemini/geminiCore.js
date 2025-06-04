// src/utils/gemini/geminiCore.js - VERSIONE COMPLETAMENTE INDIPENDENTE
import { genAI, model as geminiDefaultModel } from '../geminiSetup';
import { extractTextFromFiles } from '../pdfProcessor';

// ===== CACHE SEMPLIFICATA =====
const PDF_CACHE = new Map();
const PHASE_CACHE = new Map();
const TEXT_CACHE = new Map();

// Configurazioni essenziali - COMPLETAMENTE INDIPENDENTI
export const CONFIG = {
  AI_GENERATION: {
    responseMimeType: "application/json",
    temperature: 0.1,
    maxOutputTokens: 8192, // AUMENTATO per evitare troncamenti
  },
  CONTENT_ANALYSIS: {
    minTopicPages: 5,
    maxTopicPages: 20,
    idealTopicPages: 12,
    maxTopicsTotal: 15,
    minTopicsTotal: 5
  },
  DISTRIBUTION: {
    maxTopicsPerDay: 3,
    reserveReviewDays: true
  },
  CACHE: {
    maxEntries: 50,
    ttlHours: 24
  },
  TEXT_LIMITS: {
    maxCharsForPdf: 50000,     // AUMENTATO: 50k caratteri per modalità PDF
    maxCharsForText: 80000,    // AUMENTATO: 80k caratteri per modalità testo
    chunkSize: 15000,          // Dimensione chunk per suddividere testi lunghi
    overlapSize: 1000          // Overlap tra chunk per continuità
  }
};

// ===== UTILITY FUNCTIONS INDIPENDENTI =====

export function generateFileHash(files) {
  return files.map(f => `${f.name}-${f.size}-${f.lastModified || 'unknown'}`).join('|');
}

export function generatePhaseHash(phase, examName, files, additionalParams = '') {
  const baseHash = generateFileHash(files);
  return `${phase}_${examName}_${baseHash}_${additionalParams}`;
}

export function cleanupCache(cache, maxEntries = CONFIG.CACHE.maxEntries) {
  if (cache.size > maxEntries) {
    const entries = Array.from(cache.entries());
    const entriesToRemove = entries.slice(0, Math.floor(maxEntries / 2));
    entriesToRemove.forEach(([key]) => cache.delete(key));
  }
}

// ===== GESTIONE INTELLIGENTE DEL TESTO (NO TRONCAMENTO BRUTALE) =====

/**
 * Suddivide il testo in chunk intelligenti senza tagliare parole
 */
function splitTextIntelligently(text, maxChars, overlapChars = 1000) {
  if (text.length <= maxChars) {
    return [text];
  }

  const chunks = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    let endIndex = Math.min(startIndex + maxChars, text.length);
    
    // Se non siamo alla fine del testo, trova l'ultimo spazio per non tagliare parole
    if (endIndex < text.length) {
      const lastSpaceIndex = text.lastIndexOf(' ', endIndex);
      const lastPeriodIndex = text.lastIndexOf('.', endIndex);
      const lastNewlineIndex = text.lastIndexOf('\n', endIndex);
      
      // Usa il delimitatore più vicino alla fine
      const bestBreakPoint = Math.max(lastSpaceIndex, lastPeriodIndex, lastNewlineIndex);
      
      if (bestBreakPoint > startIndex + (maxChars * 0.7)) { // Almeno 70% del chunk
        endIndex = bestBreakPoint + 1;
      }
    }

    const chunk = text.substring(startIndex, endIndex).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    // Calcola il prossimo punto di partenza con overlap
    startIndex = Math.max(endIndex - overlapChars, endIndex);
    
    // Evita loop infiniti
    if (startIndex === endIndex) {
      startIndex = endIndex;
    }
  }

  return chunks;
}

/**
 * Estrae e processa il testo dai PDF in modo intelligente
 */
export async function extractTextFromFilesForAI(files, progressCallback, analysisMode = 'text') {
  const fileHash = generateFileHash(files) + `_text_${analysisMode}`;
  
  if (TEXT_CACHE.has(fileHash)) {
    progressCallback?.({ type: 'processing', message: 'Riutilizzo testo già estratto...' });
    return TEXT_CACHE.get(fileHash);
  }

  console.log(`📄 Estraendo testo da ${files.length} file (modalità ${analysisMode})`);
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

    // Scegli il limite appropriato basato sulla modalità
    const maxChars = analysisMode === 'pdf' ? CONFIG.TEXT_LIMITS.maxCharsForPdf : CONFIG.TEXT_LIMITS.maxCharsForText;
    
    let processedText = cleanText;
    let chunks = [];
    let isTruncated = false;

    if (charCount > maxChars) {
      console.log(`📄 Testo troppo lungo (${charCount} > ${maxChars}), suddivido in chunk`);
      
      // Suddividi in chunk intelligenti invece di troncare
      chunks = splitTextIntelligently(cleanText, CONFIG.TEXT_LIMITS.chunkSize, CONFIG.TEXT_LIMITS.overlapSize);
      
      // Per l'analisi AI, usa solo i primi chunk più rappresentativi
      const maxChunks = Math.ceil(maxChars / CONFIG.TEXT_LIMITS.chunkSize);
      const selectedChunks = chunks.slice(0, maxChunks);
      
      processedText = selectedChunks.join('\n\n--- SEZIONE SUCCESSIVA ---\n\n');
      
      if (selectedChunks.length < chunks.length) {
        isTruncated = true;
        processedText += `\n\n[NOTA: Testo suddiviso in ${chunks.length} sezioni, analizzate le prime ${selectedChunks.length} sezioni più rappresentative]`;
      }
    }

    const result = {
      fullText: processedText,
      originalFullText: cleanText, // Mantieni il testo originale completo
      pagedTextData,
      totalPages: pagedTextData.length,
      wordCount: wordCount,
      charCount: charCount,
      processedCharCount: processedText.length,
      chunks: chunks.length > 1 ? chunks : [],
      isTruncated: isTruncated,
      analysisMode: analysisMode
    };

    TEXT_CACHE.set(fileHash, result);
    cleanupCache(TEXT_CACHE);

    const message = isTruncated 
      ? `Testo processato: ${result.processedCharCount}/${charCount} caratteri (${chunks.length} sezioni)`
      : `Testo estratto: ${wordCount} parole, ${pagedTextData.length} pagine`;
    
    progressCallback?.({ type: 'processing', message });
    console.log(`✅ ${message}`);
    
    return result;

  } catch (error) {
    console.error('❌ Errore estrazione testo:', error);
    throw new Error(`Errore estrazione testo: ${error.message}`);
  }
}

/**
 * Converte un oggetto File JavaScript in una "parte" per l'API Gemini con caching
 */
export async function fileToGenerativePart(file) {
  const fileKey = `${file.name}-${file.size}-${file.lastModified || 'unknown'}`;
  
  if (PDF_CACHE.has(fileKey)) {
    return PDF_CACHE.get(fileKey);
  }

  console.log(`📄 Convertendo ${file.name} in base64...`);
  
  // Validazione file
  if (!file || !(file instanceof File)) {
    throw new Error(`Invalid file object for ${file?.name || 'unknown'}`);
  }
  
  if (file.type !== 'application/pdf') {
    throw new Error(`File ${file.name} is not a PDF`);
  }
  
  if (file.size > 50 * 1024 * 1024) { // 50MB limit
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

    PDF_CACHE.set(fileKey, generativePart);
    cleanupCache(PDF_CACHE);
    console.log(`✅ ${file.name} convertito`);
    return generativePart;
    
  } catch (error) {
    console.error(`❌ Errore conversione ${file.name}:`, error);
    throw new Error(`Failed to convert ${file.name}: ${error.message}`);
  }
}

/**
 * Prepara i file PDF per l'analisi AI (modalità PDF completa)
 */
export async function prepareFilesForAI(filesArray, originalFilesDriveInfo, progressCallback) {
  const fileHash = generateFileHash(filesArray);
  
  if (PDF_CACHE.has(fileHash + '_prepared')) {
    progressCallback?.({ type: 'processing', message: 'Riutilizzo file già processati...' });
    return PDF_CACHE.get(fileHash + '_prepared');
  }

  console.log(`📄 Preparando ${filesArray.length} file per AI`);

  const partsArray = [];
  let validPdfFilesSent = 0;

  for (let i = 0; i < filesArray.length; i++) {
    const file = filesArray[i];
    const driveInfo = originalFilesDriveInfo.find(df => df.originalFileIndex === i);

    if (file.type === "application/pdf" && driveInfo && driveInfo.name === file.name) {
      progressCallback?.({ type: 'processing', message: `Conversione ${i + 1}/${filesArray.length}: ${file.name}...` });
      
      try {
        const filePart = await fileToGenerativePart(file);
        partsArray.push(filePart);
        validPdfFilesSent++;
        console.log(`✅ ${file.name} preparato`);
      } catch (fileConvError) {
        console.error(`❌ Errore ${file.name}:`, fileConvError);
        progressCallback?.({ type: 'warning', message: `Errore ${file.name}: ${fileConvError.message}` });
      }
    }
  }

  if (validPdfFilesSent === 0) {
    throw new Error('Nessun file PDF valido è stato preparato per l\'analisi AI.');
  }

  const result = { 
    partsArray, 
    validPdfFilesSent, 
    totalExpected: filesArray.length
  };
  
  PDF_CACHE.set(fileHash + '_prepared', result);
  cleanupCache(PDF_CACHE);
  
  console.log(`✅ Preparati ${validPdfFilesSent}/${filesArray.length} file`);
  return result;
}

/**
 * Prepara il testo per l'analisi AI (modalità text-only)
 */
export async function prepareTextForAI(filesArray, progressCallback, analysisMode = 'text') {
  const textData = await extractTextFromFilesForAI(filesArray, progressCallback, analysisMode);
  
  if (!textData.fullText || textData.fullText.length < 100) {
    throw new Error('Testo estratto insufficiente per l\'analisi AI (meno di 100 caratteri).');
  }

  progressCallback?.({ type: 'processing', message: `Testo preparato: ${textData.wordCount} parole` });
  
  return {
    textContent: textData.fullText,
    metadata: {
      totalPages: textData.totalPages,
      wordCount: textData.wordCount,
      charCount: textData.charCount,
      processedCharCount: textData.processedCharCount,
      fileCount: filesArray.length,
      isTruncated: textData.isTruncated,
      chunksCount: textData.chunks.length,
      analysisMode: analysisMode
    }
  };
}

/**
 * Pulisce e corregge JSON malformato
 */
function cleanAndParseJSON(jsonString) {
  try {
    // Rimuovi markdown code blocks
    let cleaned = jsonString
      .replace(/^```json\s*/gi, '')
      .replace(/```\s*$/g, '')
      .trim();
    
    return JSON.parse(cleaned);
  } catch (error) {
    console.warn('⚠️ JSON malformato, tentando riparazione...');
    
    try {
      // Tentativi di riparazione automatica
      let repaired = jsonString
        .replace(/^```json\s*/gi, '')
        .replace(/```\s*$/g, '')
        .trim();
      
      // Trova l'ultimo carattere valido
      let lastValidIndex = repaired.length;
      let braceCount = 0;
      let inString = false;
      let escaped = false;
      
      for (let i = 0; i < repaired.length; i++) {
        const char = repaired[i];
        
        if (escaped) {
          escaped = false;
          continue;
        }
        
        if (char === '\\') {
          escaped = true;
          continue;
        }
        
        if (char === '"' && !escaped) {
          inString = !inString;
          continue;
        }
        
        if (!inString) {
          if (char === '{') braceCount++;
          if (char === '}') {
            braceCount--;
            if (braceCount === 0) {
              lastValidIndex = i + 1;
              break;
            }
          }
        }
      }
      
      // Tronca al punto valido
      repaired = repaired.substring(0, lastValidIndex);
      
      // Chiudi eventuali stringhe aperte
      if (inString) {
        repaired += '"';
      }
      
      // Chiudi eventuali oggetti aperti
      while (braceCount > 0) {
        repaired += '}';
        braceCount--;
      }
      
      console.log('✅ JSON riparato con successo');
      return JSON.parse(repaired);
    } catch (repairError) {
      console.error('❌ Riparazione JSON fallita:', repairError);
      throw new Error(`JSON parsing failed: ${error.message}. Response was likely truncated.`);
    }
  }
}

/**
 * Esegue una singola fase AI con caching e retry (supporta entrambe le modalità)
 */
export async function executeAIPhase(phaseName, promptText, filesArray, originalFilesDriveInfo, progressCallback, analysisMode = 'pdf') {
  const phaseHash = generatePhaseHash(phaseName, promptText.substring(0, 100), filesArray, analysisMode);
  
  if (PHASE_CACHE.has(phaseHash)) {
    console.log(`💾 Cache hit per fase ${phaseName}`);
    progressCallback?.({ type: 'processing', message: `Utilizzo cache per fase ${phaseName}...` });
    return PHASE_CACHE.get(phaseHash);
  }

  console.log(`\n🤖 ===== FASE AI: ${phaseName.toUpperCase()} (${analysisMode}) =====`);
  progressCallback?.({ type: 'processing', message: `Esecuzione ${phaseName} (${analysisMode})...` });

  if (!genAI || !geminiDefaultModel) {
    throw new Error('Servizio AI Gemini non inizializzato correttamente.');
  }

  const parts = [{ text: promptText.trim() }];
  console.log(`📝 Prompt: ${promptText.length} caratteri`);
  
  // Prepara i contenuti in base alla modalità
  if (filesArray && filesArray.length > 0) {
    if (analysisMode === 'text') {
      // Modalità text-only: estrai e invia solo il testo
      const textPreparation = await prepareTextForAI(filesArray, progressCallback, analysisMode);
      
      // Aggiungi il testo estratto al prompt
      const textPart = {
        text: `\n\n=== CONTENUTO ESTRATTO DAI PDF ===\n\n${textPreparation.textContent}\n\n=== METADATI ===\nFile: ${textPreparation.metadata.fileCount}\nPagine: ${textPreparation.metadata.totalPages}\nParole: ${textPreparation.metadata.wordCount}\nCaratteri processati: ${textPreparation.metadata.processedCharCount}/${textPreparation.metadata.charCount}\n${textPreparation.metadata.isTruncated ? `Testo suddiviso in ${textPreparation.metadata.chunksCount} sezioni\n` : 'Testo completo\n'}=== FINE CONTENUTO ===\n\n`
      };
      parts.push(textPart);
      console.log(`📄 Testo aggiunto: ${textPart.text.length} caratteri`);
    } else {
      // Modalità PDF completa: invia i PDF come base64
      const { partsArray } = await prepareFilesForAI(filesArray, originalFilesDriveInfo, progressCallback);
      parts.push(...partsArray);
      console.log(`📄 PDF aggiunti: ${partsArray.length} file`);
    }
  }

  const requestPayload = {
    contents: [{
      role: "user",
      parts: parts
    }],
    generationConfig: CONFIG.AI_GENERATION
  };

  console.log(`🚀 Invio richiesta a Gemini (${parts.length} parti)...`);

  // Retry logic semplice
  const maxRetries = 3;
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const startTime = Date.now();
      
      const aiResult = await geminiDefaultModel.generateContent(requestPayload);
      const response = aiResult.response;

      const duration = Date.now() - startTime;
      console.log(`⏱️ Risposta ricevuta in ${duration}ms`);

      let textResponse;
      if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
        textResponse = response.candidates[0].content.parts[0].text;
      } else {
        textResponse = response.text();
      }

      if (!textResponse || textResponse.trim().length === 0) {
        throw new Error('Risposta vuota dall\'AI');
      }
      
      // ===== LOG DETTAGLIATO RISPOSTA GEMINI =====
      console.log(`\n📤 ===== RISPOSTA GEMINI FASE ${phaseName.toUpperCase()} =====`);
      console.log(`📏 Lunghezza: ${textResponse.length} caratteri`);
      console.log(`📄 CONTENUTO RAW:`);
      console.log('```');
      console.log(textResponse);
      console.log('```');
      console.log(`📤 ===== FINE RISPOSTA GEMINI =====\n`);
      
      // Usa la funzione di pulizia JSON migliorata
      const parsedResponse = cleanAndParseJSON(textResponse);
      
      // Validazione base del risultato
      if (!parsedResponse || typeof parsedResponse !== 'object') {
        throw new Error('Risposta AI non è un oggetto JSON valido');
      }
      
      // ===== LOG DETTAGLIATO JSON PARSATO =====
      console.log(`\n🔍 ===== JSON PARSATO FASE ${phaseName.toUpperCase()} =====`);
      console.log('📋 Chiavi principali:', Object.keys(parsedResponse));
      console.log('📊 JSON COMPLETO:');
      console.log(JSON.stringify(parsedResponse, null, 2));
      console.log(`🔍 ===== FINE JSON PARSATO =====\n`);
      
      console.log(`✅ Fase ${phaseName} completata`);
      
      PHASE_CACHE.set(phaseHash, parsedResponse);
      cleanupCache(PHASE_CACHE);

      progressCallback?.({ type: 'processing', message: `Fase ${phaseName} completata.` });
      return parsedResponse;

    } catch (error) {
      lastError = error;
      console.error(`❌ Errore fase ${phaseName} (tentativo ${attempt}/${maxRetries}):`, error);
      
      if (attempt < maxRetries) {
        const delayMs = 1000 * attempt;
        progressCallback?.({ type: 'processing', message: `Ritentando ${phaseName}...` });
        console.log(`🔄 Ritento tra ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  console.error(`❌ Fase ${phaseName} fallita dopo ${maxRetries} tentativi`);
  throw new Error(`Errore nella fase ${phaseName} (${analysisMode}) dopo ${maxRetries} tentativi: ${lastError?.message || 'Errore sconosciuto'}`);
}

// ===== CACHE MANAGEMENT =====

export function getCacheStats() {
  return {
    pdfCache: PDF_CACHE.size,
    textCache: TEXT_CACHE.size,
    phaseCache: PHASE_CACHE.size,
    maxEntries: CONFIG.CACHE.maxEntries
  };
}

export function clearAllCaches() {
  const totalSize = PDF_CACHE.size + TEXT_CACHE.size + PHASE_CACHE.size;
  PDF_CACHE.clear();
  TEXT_CACHE.clear();
  PHASE_CACHE.clear();
  console.log(`🗑️ Cache pulite (${totalSize} elementi)`);
  return totalSize;
}

export { PDF_CACHE, TEXT_CACHE, PHASE_CACHE };